/**
 * remarkup - JS module for separating program logic and semantics in HTML
 * Copyright (C) 2014 Hauke Henningsen <sqrt@entless.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 **/

(function() {
'use strict';

var jsdom = require('jsdom');
var munkres = require('munkres-js');

function ReMarkup(opt) {
	opt = opt || {};
	
	this.elementFilters = opt.elementFilters || 
		[ReMarkup.defaultElementFilter(['id', 'translate-comment'])];
	this.nonexistentChildDistance = opt.nonexistentChildDistance || 10;
	this.rawElementMetric = opt.rawElementMetric ||
		ReMarkup.defaultRawElementMetric;
}

ReMarkup.prototype.applyElementFilters = function (element) {
	for (var i = 0; i < this.elementFilters.length; ++i)
		this.elementFilters[i](element);
};

ReMarkup.prototype.unMarkupRecurse = function (element) {
	this.applyElementFilters(element);
	
	for (var i = 0; i < element.children.length; ++i)
		this.unMarkupRecurse(element.children[i]);
	
	return element;
};

ReMarkup.prototype.unMarkup = function (original) {
	var doc = jsdom.jsdom(original);
	var body = doc.querySelector('body');
	
	this.unMarkupRecurse(body);
	
	return body.innerHTML;
};

ReMarkup.defaultElementFilter = function (preserveAttributes) {
	return function (element) {
		for (var i = 0; i < element.attributes.length; ) {
			var attrName = element.attributes[i].name;
			if (preserveAttributes.indexOf(attrName) == -1)
				element.removeAttribute(attrName);
			else
				++i;
		}
	}
};

ReMarkup.defaultRawElementMetric = function (e1, e2, e1i, e2i, e1pl, e2pl) {
	var distance = 0;
	
	if (e1.tagName != e2.tagName)
		distance += 3;
	
	if (e1.id && e2.id && e1.id == e2.id)
		return 0;
	
	for (var i = 0; i < e1.attributes.length; ++i) 
		if (!e2.hasAttribute(e1.attributes[i].name) ||
		     e2.getAttribute(e1.attributes[i].name) != e1.attributes[i].value)
			distance += 0.25;
	
	for (var i = 0; i < e2.attributes.length; ++i) 
		if (!e1.hasAttribute(e2.attributes[i].name) ||
		     e1.getAttribute(e2.attributes[i].name) != e2.attributes[i].value)
			distance += 0.25;
	
	distance += Math.abs(e1i - e2i);
	
	return distance;
};

function getElementIndex (list, element) {
	for (var i = 0; i < list.length; ++i)
		if (list[i].isSameNode(element))
			return i;
	
	return null;
}

function copyAttributes (src, dst) {
	for (var i = 0; i < src.attributes.length; ++i)
		dst.setAttribute(src.attributes[i].name, src.attributes[i].value);
}

ReMarkup.prototype.reMarkup = function (original, modified) {
	var self = this;
	
	var origDoc = jsdom.jsdom(original),
	    modDoc  = jsdom.jsdom(modified);
	
	var origBody = origDoc.querySelector('body');
	var modBody  = modDoc .querySelector('body');
	
	var origElements = Array.prototype.slice.call(origBody.querySelectorAll('*'));
	var modElements  = Array.prototype.slice.call(modBody .querySelectorAll('*'));
	
	var distanceMatrix = [];
	for (var i = 0; i < origElements.length; ++i)
		distanceMatrix[i] = [];
	
	function computeElementDistance (e1, e2) {
		var e1i = getElementIndex(origElements, e1);
		var e2i = getElementIndex(modElements,  e2);
		
		// do we already know the distance?
		if (typeof distanceMatrix[e1i][e2i] != 'undefined')
			return distanceMatrix[e1i][e2i];
		
		var totalChildDistance = 0;
		
		if (e1.children.length > 0 && e2.children.length > 0) {
			var childMatrix = [];
			
			for (var i = 0; i < e1.children.length; ++i) {
				childMatrix[i] = [];
				
				for (var j = 0; j < e2.children.length; ++j)
					childMatrix[i][j] = computeElementDistance(e1.children[i], e2.children[j]);
			}
			
			var m = new munkres.Munkres();
			var indices = m.compute(childMatrix);
		
			for (var k = 0; k < indices.length; ++k) {
				var ci = indices[k][0], cj = indices[k][1];
				totalChildDistance += childMatrix[ci][cj];
			}
		}
		
		totalChildDistance += Math.abs(e1.children.length - e2.children.length) * self.nonexistentChildDistance;
		
		var e1_ = self.unMarkupRecurse(e1.cloneNode(true));
		var rawElementDistance = self.rawElementMetric(
		    e1_, e2,
		    e1i, e2i,
		    e1.parentNode.children.length, e2.parentNode.children.length);
		
		return distanceMatrix[e1i][e2i] = totalChildDistance + rawElementDistance;
	}
	
	for (var i = 0; i < origElements.length; ++i)
		for (var j = 0; j < modElements.length; ++j)
			computeElementDistance(origElements[i], modElements[j]);
	
	var m = new munkres.Munkres();
	var indices = m.compute(distanceMatrix);
		
	for (var k = 0; k < indices.length; ++k) {
		var ci = indices[k][0], cj = indices[k][1];
		var e1 = origElements[ci];
		var e2 = modElements [cj];
		
		copyAttributes(e1, e2);
	}
	
	return modBody.innerHTML;
};

exports.ReMarkup = ReMarkup;

})();
