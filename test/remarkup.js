'use strict';

var assert = require('assert');

var remarkup = require('../');

// sample strings
var bananasOriginal = '<span ng-show="true"><span>Bananas</span> are ' +
	'<em id="emphasized" style="background-color: red">great</em>!' +
	'</span>';

var bananasGermanCorrectNoID = '<span><span>Bananen</span> sind <em>toll</em>!</span>';
var bananasGermanCorrectID = '<span><em id="emphasized">Toll</em> sind <span>Bananen</span>!</span>';
var bananasGermanIncorrect = '<span><span>Bananen</span> sind</span><em>toll!</em>';

describe('ReMarkup', function() {
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
	});
});
