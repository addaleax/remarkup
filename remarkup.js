/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014, 2015 Anna Henningsen <sqrt@entless.org>
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
var levenshtein = require('fast-levenshtein');
var assert = require('assert');

/**
 * Provides methods for removing attributes from HTML fragments
 * and re-adding them later, possibly on a modified
 * (e.g. translated) HTML string.
 * 
 * @param {object} [opt] 
 *       Options for matching and modifying the HTML elements
 * @param {function[]} [opt.elementFilters]  
 *       An array of callbacks for modifying the
 *       HTML elements (passed as DOM nodes).
 *       The default is a {@link ReMarkup.defaultElementFilter}
 *       which preserves <code>id</code> and <code>translate-*</code>
 *       attributes, as well as all semantically relevant attributes.
 *       (See {@link ReMarkup#semanticAttributes}).
 *       (For {@link ReMarkup#unMarkup}).
 * @param {function[]} [opt.additionalElementFilters]
 *       Like <code>elementFilters</code>, but appended in addition
 *       to the standard filters.
 * @param {number} [opt.nonexistentChildDistance]
 *       The distance that will be used when an child
 *       element is present in the original tree
 *       but not the modified one or vice versa.
 *       The default value is 10.
 *       (For {@link ReMarkup#reMarkup}).
 * @param {function} [opt.rawElementMetric]
 *       A distance function for DOM HTML elements.
 *       The default is {@link ReMarkup.defaultRawElementMetric}.
 *
 * @constructor ReMarkup
 * @public
 */
function ReMarkup(opt) {
  opt = opt || {};
  
  this.elementFilters = opt.elementFilters || [
    ReMarkup.defaultElementFilter(['id', /^(remarkup|translate)-.+$/]
      .concat(this.semanticAttributes))
  ].concat(opt.additionalElementFilters || []);
  
  this.nonexistentChildDistance = opt.nonexistentChildDistance || 10;
  this.rawElementMetric = opt.rawElementMetric ||
    ReMarkup.defaultRawElementMetric;
}

/**
 * Add a filter to the elementFilters list.
 * 
 * @param {function} filter  The element filter.
 * 
 * @public
 * @method ReMarkup#addElementFilter
 */
ReMarkup.prototype.addElementFilter = function(filter) {
  this.elementFilters.push(filter);
};

/**
 * List of semantically relevant HTML attributes.
 * These will be preserved by the default {@link ReMarkup#unMarkup}
 * element filters and ignored by the default {@link ReMarkup#reMarkup}
 * metric and its copy mechanism.
 * 
 * @type {string[]}
 * @member ReMarkup#semanticAttributes
 */
ReMarkup.prototype.semanticAttributes = [
  'alt', 'label', 'placeholder', 'title', 'tooltip', 'data-info', 'popover',
  function(name, element) {
    return name == 'value' && ['button', 'submit'].indexOf(element.getAttribute('type')) != -1;
  }
];

/**
 * Applies the list of element filters to a single element.
 * 
 * @param {DOMElement} element  The target element.
 * 
 * @private
 * @method ReMarkup#applyElementFilters
 */
ReMarkup.prototype.applyElementFilters = function (element) {
  for (var i = 0; i < this.elementFilters.length; ++i)
    this.elementFilters[i](element);
};

/**
 * Recursively apply the element filters to an element and all its children.
 * 
 * @param {DOMElement} element  The target element.
 * 
 * @return {DOMElement}  The original target element.
 * 
 * @private
 * @method ReMarkup#unMarkupRecurse
 */
ReMarkup.prototype.unMarkupRecurse = function (element) {
  this.applyElementFilters(element);
  
  for (var i = 0; i < element.children.length; ++i)
    this.unMarkupRecurse(element.children[i]);
  
  return element;
};

/**
 * Apply the element filters to an HTML fragment.
 * 
 * @param {string} original  The target HTML fragment.
 * 
 * @return {string}  A modified HTML fragment.
 * 
 * @public
 * @method ReMarkup#unMarkup
 */
ReMarkup.prototype.unMarkup = function (original) {
  var doc = jsdom.jsdom(original);
  var body = doc.querySelector('body');
  
  this.unMarkupRecurse(body);
  
  return body.innerHTML;
};

/**
 * An element filter for stripping whitespace after/before
 * tags and newlines and collapse multiple spaces into a single one.
 * 
 * @param {DOMElement} element  The target element.
 * 
 * @return {DOMElement}  The original target element.
 * 
 * @public
 * @function ReMarkup.stripSpaces
 */
ReMarkup.stripSpaces = function (element) {
  for (var i = 0; i < element.childNodes.length; ++i) {
    var node = element.childNodes[i];
    if (node.nodeType != node.TEXT_NODE)
      continue;
    
    // collapse multiple spaces
    
    /* only \t, \n, \r, space since other spaces (e.g. nbsp)
     * may carry some semantic meaning */
    node.data = node.data
      .replace(/[\t\n\r ]+/g, ' ');
    
    // remove starting/ending whitespace
    if (i == 0)
      node.data = node.data.replace(/^[\t\n\r ]+/g, '');
    
    if (i == element.childNodes.length - 1)
      node.data = node.data.replace(/[\t\n\r ]+$/g, '');
  }
  
  return element;
};

/**
 * Creates a default element filter that removes most attributes.
 * 
 * @param {string[]} preserveAttributes
 *                     A list of strings and/or regex objects that
 *                     element attributes are validated against.
 * 
 * @return {function}  An element filter that removes all attributes
 *                     but those specified as preserved.
 * 
 * @public
 * @function ReMarkup.defaultElementFilter
 */
ReMarkup.defaultElementFilter = function (preserveAttributes) {
  return function (element) {
    var originalElement = element.cloneNode(true);
    
    for (var i = 0; i < element.attributes.length; ) {
      var attrName = element.attributes[i].name;
      
      var shouldBePreserved = false;
      for (var j = 0; j < preserveAttributes.length; ++j) {
        if ((preserveAttributes[j].call &&
             preserveAttributes[j].call(element, attrName, originalElement, element)) ||
            (preserveAttributes[j].test && 
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

/**
 * The default element metric.
 * This compares elements and their position in the DOM tree
 * and returns a number that indicates how un-similar the
 * given elements are.
 * 
 * This returns a distance of 0 for elements which share the 
 * same value for either of the <code>id</code>, 
 * <code>translate-id</code> or <code>remarkup-id</code> attributes.
 * 
 * @public
 * @function ReMarkup.defaultRawElementMetric
 */
ReMarkup.defaultRawElementMetric = function (e1, e2, e1i, e2i, e1pl, e2pl) {
  // attributes that lead to definite matching of elements
  var identAttr = ['id', 'translate-id', 'remarkup-id'];
  
  for (var i = 0; i < identAttr.length; ++i)
    if (e1.hasAttribute(identAttr[i]) && e2.hasAttribute(identAttr[i]) &&
        e1.getAttribute(identAttr[i]) == e2.getAttribute(identAttr[i]))
      return 0;
  
  var distance = 5; // minimum distance for elements with different IDs
  if (e1.tagName != e2.tagName)
    distance += 3;
  
  for (var i = 0; i < e1.attributes.length; ++i) 
    if (!e2.hasAttribute(e1.attributes[i].name) && 
        this.semanticAttributes.indexOf(e1.attributes[i].name) == -1)
      distance++;
  
  for (var i = 0; i < e2.attributes.length; ++i) {
    if (this.semanticAttributes.indexOf(e2.attributes[i].name) != -1)
      continue;
    
    if (!e1.hasAttribute(e2.attributes[i].name)) {
      distance++;
    } else {
      var attrValue1 = e1.getAttribute(e2.attributes[i].name);
      var attrValue2 = e2.attributes[i].value;
      
      if (attrValue1 != attrValue2)
        distance += 2 * Math.log(levenshtein.get(attrValue1, attrValue2));
    }
  }
  
  var positionDistance = Math.abs(e1i - e2i);
  if (positionDistance > 0)
    distance += 2 * Math.log(positionDistance) + 1;
  
  return distance;
};

// copy all DOM attributes from src to dst
function copyAttributes (src, dst, ignored) {
  ignored = ignored || [];
  
  for (var i = 0; i < src.attributes.length; ++i)
    if (ignored.indexOf(src.attributes[i].name) == -1)
      dst.setAttribute(src.attributes[i].name, src.attributes[i].value);
}

/**
 * Re-adds attributes from an original HTML fragment
 * to a, possibly modified, one.
 * 
 * @param {string} original  The original HTML fragment, including all attributes.
 * @param {string} modified  The target HTML fragment.
 * 
 * @return {string}  An HTML fragment, with the attributes from the original string
 *                   added to the modified one.
 * 
 * @public
 * @method ReMarkup#reMarkup
 */
ReMarkup.prototype.reMarkup = function (original, modified) {
  var self = this;
  
  var origDoc = jsdom.jsdom(original),
      modDoc  = jsdom.jsdom(modified);
  
  var origBody = origDoc.querySelector('body');
  var modBody  = modDoc .querySelector('body');
  
  var origElements = Array.prototype.slice.call(origBody.querySelectorAll('*'));
  var modElements  = Array.prototype.slice.call(modBody .querySelectorAll('*'));
  
  if (origElements.length == 0 || modElements.length == 0)
    return modified;
  
  var distanceMatrix = [];
  for (var i = 0; i < origElements.length; ++i)
    distanceMatrix[i] = [];
  
  // compute the distance of a original and a modified element
  // and enter it into the distance matrix
  function computeElementDistance (e1, e2) {
    var e1i = origElements.indexOf(e1);
    var e2i = modElements .indexOf(e2);
    
    // do we already know the distance?
    if (typeof distanceMatrix[e1i][e2i] != 'undefined')
      return distanceMatrix[e1i][e2i];
    
    var totalChildDistance = 0;
    
    if (e1.children.length > 0 && e2.children.length > 0) {
      // compute all distances between the children of the elements...
      var childMatrix = [];
      
      for (var i = 0; i < e1.children.length; ++i) {
        childMatrix[i] = [];
        
        for (var j = 0; j < e2.children.length; ++j)
          childMatrix[i][j] = computeElementDistance(e1.children[i], e2.children[j]);
      }
      
      // ... and find the minimal assignment between these
      var m = new munkres.Munkres();
      var indices = m.compute(childMatrix);
    
      for (var k = 0; k < indices.length; ++k) {
        var ci = indices[k][0], cj = indices[k][1];
        totalChildDistance += childMatrix[ci][cj];
      }
    }
    
    // add penalty for differing number of child elements
    totalChildDistance += Math.abs(e1.children.length - e2.children.length) * self.nonexistentChildDistance;
    
    // compare to the element that unMarkup produces from e1
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
    
    copyAttributes(e1, e2, this.semanticAttributes);
  }
  
  return modBody.innerHTML;
};

exports.ReMarkup = ReMarkup;

})();
