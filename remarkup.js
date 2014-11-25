/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014  Hauke Henningsen <sqrt@entless.org>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 **/

(function() {
'use strict';

var jsdom = require('jsdom');
var munkres = require('munkres-js');

function ReMarkup(opt) {
	opt = opt || {};
	
	this.elementFilters = opt.elementFilters || 
		[ReMarkup.defaultElementFilter(['id', /^translate-.+$/])];
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
			
			var shouldBePreserved = false;
			for (var j = 0; j < preserveAttributes.length; ++j) {
				if ((preserveAttributes[j].test && 
				     preserveAttributes[j].test(attrName)) ||
				    attrName == preserveAttributes[j]) 
				{
					shouldBePreserved = true;
					break;
				}
			}
				
			if (!shouldBePreserved)
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
