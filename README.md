remarkup
===========

[![NPM Version](https://img.shields.io/npm/v/remarkup.svg?style=flat)](https://npmjs.org/package/remarkup)
[![NPM Downloads](https://img.shields.io/npm/dm/remarkup.svg?style=flat)](https://npmjs.org/package/remarkup)
[![Build Status](https://travis-ci.org/addaleax/remarkup.png?style=flat)](https://travis-ci.org/addaleax/remarkup)
[![Coverage Status](https://coveralls.io/repos/addaleax/remarkup/badge.svg?branch=master)](https://coveralls.io/r/addaleax/remarkup?branch=master)
[![Dependency Status](https://david-dm.org/addaleax/remarkup.svg?style=flat)](https://david-dm.org/addaleax/remarkup)
[![devDependency Status](https://david-dm.org/addaleax/remarkup/dev-status.svg?style=flat)](https://david-dm.org/addaleax/remarkup#info=devDependencies)

Provides an API for separating program logic and semantics in HTML, e.g. for translation.

Install via `npm install remarkup`.

## For `.po` files

There are utilities and a CLI available at [remarkup-po](https://github.com/addaleax/remarkup-po).

## Example usage

```js
var ReMarkup = require('remarkup');

var rm = new ReMarkup();

var exampleHTML =
'<div class="remarkup-example">' +
'    <span data-foodtype="fruit">Bananas</span> are <em>great</em>!</span>' +
'    <span>Let’s eat one!</span>' +
'</div>';

rm.unMarkup(exampleHTML) 
// <div><span>Bananas</span> are <em>great</em>!<span>Let’s eat one!</span></div>

var translatedHTML =
'<div><span>Bananen</span> sind <em>toll</em>! <span>Lass uns eine essen!</span></div>';

rm.reMarkup(exampleHTML, translatedHTML)
// <div class="remarkup-example"><span data-foodtype="fruit">Bananen</span> sind <em>toll</em>!
// <span>Lass uns eine essen!</span></div>
```

As you can see, `unMarkup` simplified the string so that it is suitable for human
manipulation, whereas `reMarkup` re-added the information lost in the previous process
– simple as that!

There are some more options available; See the source for information on further parameters.

To some degree, elements that are moved within the HTML tree or otherwise
significantly modified can still be matched.
It is strongly recommended that the essentially the same options are used for
`unMarkup` and `reMarkup` so that the matching in `reMarkup` can compare the
modified elements to what `unMarkup` would have produced.

With the default options, attributes that match `id`, `translate-*` or `remarkup-*`
are kept by `unMarkup` (along with semantically relevant attributes like
`placeholder` or `title`). When you consider it possible that, during human
manipulation, the elements are re-ordered or otherwise drastically modified,
you may want to use attributes like `id` or `translate-id` to faciliate
distinguishing elements for `reMarkup`.

Note that this module is under active development and a lot of default options may
be subject to optimization.

## License

MIT
