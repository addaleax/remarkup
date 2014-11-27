'use strict';

var assert = require('assert');

var remarkup = require('../');

describe('ReMarkup', function() {
	// generic sample strings
	var bananasOriginal = '<span ng-show="true"><span>Bananas</span> are ' +
		'<em id="emphasized" style="background-color: red">great</em>!' +
		'</span>';
	var bananasGermanCorrectNoID = '<span><span>Bananen</span> sind <em>toll</em>!</span>';
	var bananasGermanCorrectID = '<span><em id="emphasized">Toll</em> sind <span>Bananen</span>!</span>';
	var bananasGermanIncorrect = '<span><span>Bananen</span> sind</span><em>toll!</em>';

	describe('#unMarkup', function() {
		it('should strip most attributes by default', function() {
			var rm = new remarkup.ReMarkup();
			
			var modified = rm.unMarkup(bananasOriginal);
			assert.equal(modified.indexOf('ng-show'), -1);
			assert.equal(modified.indexOf('style'), -1);
			assert.notEqual(modified.indexOf('id="emphasized"'), -1);
		});
		
		it('should not modify the text content', function() {
			var rm = new remarkup.ReMarkup();
			
			var modified = rm.unMarkup(bananasOriginal);
			assert.notEqual(modified.replace(/<[^>]+>/g, '').indexOf('Bananas are'), -1);
			assert.notEqual(modified.indexOf('great'), -1);
		});
	});
	
	describe('#reMarkup', function() {
		it('should match elements correctly with identical tree structures', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(bananasOriginal, bananasGermanCorrectNoID);
			
			assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
			assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
		});
		
		it('should match elements correctly with different tree structures with id attributes', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(bananasOriginal, bananasGermanCorrectID);
			
			assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
			assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
		});
		
		it('should match elements correctly with different tree structures when possible', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(bananasOriginal, bananasGermanIncorrect);
			
			assert.ok(remarkupped.match(/<span[^>]+ng-show/)); // span with ng-show
			assert.ok(remarkupped.match(/<em[^>]+background-color/)); // em with style
		});
		
		var yodaOriginal = 'Lost <span translate-role="object">a planet</span> <span translate-role="subject">Master Obi-Wan</span> has.';
		var yodaModified = '<span translate-role="subject">Master Obi-Wan</span> has lost <span translate-role="object">a planet</span>.';

		it('should help Master Yoda fix his sentences', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(yodaOriginal, yodaModified);
			
			assert.ok(remarkupped.match(/subject[^<]+Obi-Wan/)); // Obi-Wan is subject
			assert.ok(remarkupped.match(/object[^<]+planet/)); // a planet is the object
		});

		var translateIDOriginal = '<div><div translate-id="a" class="weird">Weird</div> <span class="nesting">nesting</span></div>';
		var translateIDModified = '<div><div>Weird</div> <span translate-id="a">nesting</span></div>';
		
		it('should recognize the translate-id attribute', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(translateIDOriginal, translateIDModified);
			
			assert.ok(remarkupped.match(/<div[^>]+nesting/)); // switched span, div
			assert.ok(remarkupped.match(/<span[^>]+weird/));
		});
		
		var longSentenceOriginal = '<p class="info">' +
			'<span translate-id="existence-quantifier" class="testclass">There can be</span>' +
			'<span>a lot of different solutions</span>' +
			'<span>for <span class="missing">your</span> translation needs!</span>' +
			'<span>Just ask for help!</span>' +
			'</p>';
		var longSentenceModified = '<p>' +
			'<span>Fragen Sie einfach nach!</span>' +
			'<span>Es kann</span>' +
			'<span>viele verschiedene Lösungsansätze</span>' +
			'<span>für Ihre Übersetzungsprobleme</span>' +
			'<span translate-id="existence-quantifier">geben!</span>' +
			'</p>';
		
		it('should match translate-id elements over longer distances within a tree', function() {
			var rm = new remarkup.ReMarkup();
			
			var remarkupped = rm.reMarkup(longSentenceOriginal, longSentenceModified);
			
			assert.ok(remarkupped.match(/testclass[^<]+geben/)); // match existence quantifiers together
		});
	});
});
