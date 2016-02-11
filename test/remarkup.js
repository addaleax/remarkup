'use strict';

const assert = require('assert');

const ReMarkup = require('../');

describe('ReMarkup', function() {
  // generic sample strings
  const bananasOriginal = '<span ng-show="true"><span>Bananas</span> are ' +
    '<em id="emphasized" style="background-color: red">great</em>!' +
    '</span>';
  const bananasGermanCorrectNoID = '<span><span>Bananen</span> sind <em>toll</em>!</span>';
  const bananasGermanCorrectID = '<span><em id="emphasized">Toll</em> sind <span>Bananen</span>!</span>';
  const bananasGermanIncorrect = '<span><span>Bananen</span> sind</span><em>toll!</em>';
  
  const tableRowOriginal = '<td>Column I</td><td>Column II</td>';
  
  const imageOriginal = '<a href="#" title="This instructs you to click on the image">' + 
    'Please click on this image: <img src="tux.png" alt="Image of Tux, a Penguin"></a>';
  const imageModified = '<a href="#" title="Dies ist eine Anweisung, auf das Bild zu klicken">' + 
    'Bitte klicke auf dieses Bild: <img src="tux.png" alt="Bild von Tux, einem Pinguin"></a>';
  
  const inputTestOriginal = '<input type="text" value="Removed text" />' +
    '<input type="button" value="Still there" />';
  const inputTestModified = '<input type="text" value="Text field text changed" />' +
    '<input type="button" value="Button text changed" />';
  
  const whitespaceTestOriginal = '<a>  Some of the  whitespaces in this sentence should be <em>removed </em> \n' +
    '\t\t\tin some cases</a>';
  const whitespaceTestExpect = '<a>Some of the whitespaces in this sentence should be <em>removed</em> in some cases</a>';

  describe('#unMarkup', function() {
    it('should strip most attributes by default', function() {
      const rm = new ReMarkup();
      
      const modified = rm.unMarkup(bananasOriginal);
      assert.equal(modified.indexOf('ng-show'), -1);
      assert.equal(modified.indexOf('style'), -1);
      assert.notEqual(modified.indexOf('id="emphasized"'), -1);
    });
    
    it('should not modify the text content', function() {
      const rm = new ReMarkup();
      
      const modified = rm.unMarkup(bananasOriginal);
      assert.notEqual(modified.replace(/<[^>]+>/g, '').indexOf('Bananas are'), -1);
      assert.notEqual(modified.indexOf('great'), -1);
    });
    
    it('should keep attributes like "alt" and "title"', function() {
      const rm = new ReMarkup();
      
      const modified = rm.unMarkup(imageOriginal);
      assert.notEqual(modified.indexOf('instructs'), -1);
      assert.notEqual(modified.indexOf('Penguin'), -1);
    });
    
    it('should keep the "value" attribute of input elements of certain types', function() {
      const rm = new ReMarkup();
      
      const modified = rm.unMarkup(inputTestOriginal);
      assert.equal   (modified.indexOf('Removed text'), -1);
      assert.notEqual(modified.indexOf('Still there'), -1);
    });
    
    it('should strip whitespace if asked to', function() {
      const rm = new ReMarkup({
        additionalElementFilters: ReMarkup.stripSpaces
      });
      
      const modified = rm.unMarkup(whitespaceTestOriginal);
      assert.equal(modified, whitespaceTestExpect);
    });
    
    it('should keep data fields in implicit <tr> tags', function() {
      const rm = new ReMarkup();
      
      const modified = rm.unMarkup(tableRowOriginal);
      assert.notEqual(modified.indexOf('<td>'), -1);
    });
  });
  
  describe('#reMarkup', function() {
    it('should match elements correctly with identical tree structures', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(bananasOriginal, bananasGermanCorrectNoID);
      
      assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
      assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
    });
    
    it('should match elements correctly with different tree structures with id attributes', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(bananasOriginal, bananasGermanCorrectID);
      
      assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
      assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
    });
    
    it('should match elements correctly with different tree structures when possible', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(bananasOriginal, bananasGermanIncorrect);
      
      assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
      assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
    });
    
    const yodaOriginal = 'Lost <span translate-role="object">a planet</span> <span translate-role="subject">Master Obi-Wan</span> has.';
    const yodaModified = '<span translate-role="subject">Master Obi-Wan</span> has lost <span translate-role="object">a planet</span>.';

    it('should help Master Yoda fix his sentences', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(yodaOriginal, yodaModified);
      
      assert.ok(remarkupped.match(/subject[^<]+Obi-Wan/)); // Obi-Wan is subject
      assert.ok(remarkupped.match(/object[^<]+planet/)); // a planet is the object
    });

    const translateIDOriginal = '<div><div translate-id="a" class="weird">Weird</div> <span class="nesting">nesting</span></div>';
    const translateIDModified = '<div><div>Weird</div> <span translate-id="a">nesting</span></div>';
    
    it('should recognize the translate-id attribute', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(translateIDOriginal, translateIDModified);
      
      assert.ok(remarkupped.match(/<div[^>]+nesting/)); // switched span, div
      assert.ok(remarkupped.match(/<span[^>]+weird/));
    });
    
    const longSentenceOriginal = '<p class="info">' +
      '<span translate-id="existence-quantifier" class="testclass">There can be</span>' +
      '<span>a lot of different solutions</span>' +
      '<span translate-id="translation-needs">for your translation needs!</span>' +
      '<span>Just ask for help!</span>' +
      '</p>';
    const longSentenceModified = '<p>' +
      '<span>Fragen Sie einfach nach!</span>' +
      '<span>Es kann</span>' +
      '<span>viele verschiedene Lösungsansätze</span>' +
      '<span>für Ihre Übersetzungsprobleme</span>' +
      '<span translate-id="existence-quantifier">geben!</span>' +
      '</p>';
    
    it('should match translate-id elements over longer distances within a tree', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(longSentenceOriginal, longSentenceModified);
      
      assert.ok( remarkupped.match(/testclass[^<]+geben/)); // match existence quantifiers together
      assert.ok(!remarkupped.match(/missing/));
    });
    
    it('should not override "alt" or "title" attributes', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(imageOriginal, imageModified);
      
      assert.notEqual(remarkupped.indexOf('Anweisung'), -1);
      assert.notEqual(remarkupped.indexOf('Pinguin'), -1);
    });
    
    it('should modify the "value" attribute of input elements of certain types', function() {
      const rm = new ReMarkup();
      
      const remarkupped = rm.reMarkup(inputTestOriginal, inputTestModified);
      
      assert.notEqual(remarkupped.indexOf('Removed text'), -1);
      assert.equal   (remarkupped.indexOf('Still there'), -1);
      assert.equal   (remarkupped.indexOf('Text field text changed'), -1);
      assert.notEqual(remarkupped.indexOf('Button text changed'), -1);
    });
  });
});
