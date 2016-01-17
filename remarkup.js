;(function() {
'use strict';

const $ = require('cheerio');
const munkres = require('munkres-js');
const levenshtein = require('fast-levenshtein');
const assert = require('assert');

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
class ReMarkup {
  constructor(opt) {
    opt = opt || {};
    
    this.elementFilters = opt.elementFilters || [
      ReMarkup.defaultElementFilter(['id', /^(remarkup|translate)-.+$/]
        .concat(this.semanticAttributes()))
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
  addElementFilter(filter) {
    this.elementFilters.push(filter);
  }

  /**
   * List of semantically relevant HTML attributes.
   * These will be preserved by the default {@link ReMarkup#unMarkup}
   * element filters and ignored by the default {@link ReMarkup#reMarkup}
   * metric and its copy mechanism.
   * 
   * @private
   * @method ReMarkup#semanticAttributes
   */
  semanticAttributes() {
    return [
      'alt', 'label', 'placeholder', 'title', 'tooltip', 'data-info', 'popover',
      (name, element) => {
        return name == 'value' && ['button', 'submit'].indexOf(element.attr('type')) != -1;
      }
    ];
  }

  /**
   * Applies the list of element filters to a single element.
   * 
   * @param {DOMElement} element  The target element.
   * 
   * @private
   * @method ReMarkup#applyElementFilters
   */
  applyElementFilters(element) {
    for (let i = 0; i < this.elementFilters.length; ++i) {
      this.elementFilters[i](element);
    }
  }
  
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
  unMarkupRecurse(element) {
    this.applyElementFilters(element);
    
    element.children().each((i, child) => {
      this.unMarkupRecurse($(child));
    });
    
    return element;
  }

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
  unMarkup(original) {
    const doc = $.load(original);
    const root = doc.root();
    
    this.unMarkupRecurse(root);
    
    return root.html();
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
  reMarkup(original, modified) {
    const origDoc = $.load(original).root(),
          modDoc  = $.load(modified).root();
    
    // convert lists of all elements to arrays so that indices work
    const origElements = Array.prototype.slice.call(origDoc.find('*'));
    const modElements  = Array.prototype.slice.call(modDoc .find('*'));
    
    if (origElements.length == 0 || modElements.length == 0)
      return modified;
    
    const distanceMatrix = [];
    for (let i = 0; i < origElements.length; ++i)
      distanceMatrix[i] = [];
    
    // compute the distance of a original and a modified element
    // and enter it into the distance matrix
    const computeElementDistance = (e1unwrapped, e2unwrapped) => {
      const e1i = origElements.indexOf(e1unwrapped);
      const e2i = modElements .indexOf(e2unwrapped);
      
      assert.notStrictEqual(e1i, -1);
      assert.notStrictEqual(e2i, -1);
      
      const e1 = $(e1unwrapped), e2 = $(e2unwrapped);
      
      // do we already know the distance?
      if (typeof distanceMatrix[e1i][e2i] != 'undefined')
        return distanceMatrix[e1i][e2i];
      
      let totalChildDistance = 0;
      
      let e1children = e1.children();
      let e2children = e2.children();
      
      if (e1children.length > 0 && e2children.length > 0) {
        // compute all distances between the children of the elements...
        const childMatrix = [];
        
        for (let i = 0; i < e1children.length; ++i) {
          childMatrix[i] = [];
          
          for (let j = 0; j < e2children.length; ++j) {
            childMatrix[i][j] = computeElementDistance(e1children[i], e2children[j]);
          }
        }
        
        // ... and find the minimal assignment between these
        const m = new munkres.Munkres();
        const indices = m.compute(childMatrix);
      
        for (let k = 0; k < indices.length; ++k) {
          const ci = indices[k][0],
                cj = indices[k][1];
          
          totalChildDistance += childMatrix[ci][cj];
        }
      }
      
      // add penalty for differing number of child elements
      totalChildDistance += Math.abs(e1children.length - e2children.length) * this.nonexistentChildDistance;
      
      // compare to the element that unMarkup produces from e1
      const e1_ = this.unMarkupRecurse(e1.clone());
      const rawElementDistance = this.rawElementMetric(
          e1_, e2,
          e1i, e2i,
          e1.parent().children().length,
          e2.parent().children().length);
      
      return distanceMatrix[e1i][e2i] = totalChildDistance + rawElementDistance;
    }
    
    for (let i = 0; i < origElements.length; ++i)
      for (let j = 0; j < modElements.length; ++j)
        computeElementDistance(origElements[i], modElements[j]);
    
    const m = new munkres.Munkres();
    const indices = m.compute(distanceMatrix);
    
    for (let k = 0; k < indices.length; ++k) {
      const ci = indices[k][0], cj = indices[k][1];
      const e1 = origElements[ci];
      const e2 = modElements [cj];
      
      copyAttributes(e1, e2, this.semanticAttributes());
    }
    
    return modDoc.html();
  }
}

/**
 * An element filter for stripping whitespace after/before
 * tags and newlines and collapse multiple spaces into a single one.
 * 
 * @param {DOMElement} cElement  The target element.
 * 
 * @return {DOMElement}  The original target element.
 * 
 * @public
 * @function ReMarkup.stripSpaces
 */
ReMarkup.stripSpaces = function (cElement) {
  const element = cElement[0];
  
  for (let i = 0; i < element.children.length; ++i) {
    const node = element.children[i];
    if (node.type !== 'text')
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
  return element => {
    const originalElement = element.clone();
    
    Object.keys(element.attr() || {}).forEach(attrName => {
      let shouldBePreserved = false;
      for (let j = 0; j < preserveAttributes.length; ++j) {
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
        element.removeAttr(attrName);
    });
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
  const identAttr = ['id', 'translate-id', 'remarkup-id'];
  
  for (let i = 0; i < identAttr.length; ++i) {
    if (typeof e1.attr(identAttr[i]) !== 'undefined' &&
        typeof e2.attr(identAttr[i]) !== 'undefined' &&
        e1.attr(identAttr[i]) === e2.attr(identAttr[i])) {
      return 0;
    }
  }
  
  let distance = 5; // minimum distance for elements with different IDs
  assert.ok(e1[0].tagName);
  assert.ok(e2[0].tagName);
  if (e1[0].tagName !== e2[0].tagName) {
    distance += 3;
  }
  
  const e1attribs = Object.keys(e1.attr() || {});
  const e2attribs = Object.keys(e2.attr() || {});
  for (let i = 0; i < e1attribs.length; ++i) {
    if (e2attribs.indexOf(e1attribs[i]) === -1 &&
        this.semanticAttributes().indexOf(e1attribs[i]) === -1) {
      distance++;
    }
  }
  
  for (let i = 0; i < e2attribs.length; ++i) {
    if (this.semanticAttributes().indexOf(e2attribs[i]) !== -1) {
      continue;
    }
    
    if (e1attribs.indexOf(e2attribs[i]) === -1) {
      distance++;
    } else {
      const attrValue1 = e1.attr(e2attribs[i]);
      const attrValue2 = e2.attr(e2attribs[i]);
      
      if (attrValue1 !== attrValue2) {
        distance += 2 * Math.log(levenshtein.get(attrValue1, attrValue2));
      }
    }
  }
  
  const positionDistance = Math.abs(e1i - e2i);
  if (positionDistance > 0)
    distance += 2 * Math.log(positionDistance) + 1;
  
  return distance;
};

module.exports = ReMarkup;

// copy all DOM attributes from src to dst
function copyAttributes (src, dst, ignored) {
  ignored = ignored || [];
  
  const srcAttribs = Object.keys(src.attribs || src.attributes);
  for (let i = 0; i < srcAttribs.length; ++i) {
    if (ignored.indexOf(srcAttribs[i]) === -1) {
      dst.attribs[srcAttribs[i]] = src.attribs[srcAttribs[i]];
    }
  }
}

})();
