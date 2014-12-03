remarkup
===========

[![Build Status](https://travis-ci.org/addaleax/remarkup.png)](https://travis-ci.org/addaleax/remarkup)
[![Dependency Status](https://david-dm.org/addaleax/remarkup.svg)](https://david-dm.org/addaleax/remarkup)
[![devDependency Status](https://david-dm.org/addaleax/remarkup/dev-status.svg)](https://david-dm.org/addaleax/remarkup#info=devDependencies)

Provides an API for separating program logic and semantics in HTML, e.g. for translation.

Install via `npm install remarkup`.

## Example usage

```js
var ReMarkup = require('remarkup').ReMarkup;

var rm = new ReMarkup();

var exampleHTML =
'<div class="remarkup-example">' +
'	<span data-foodtype="fruit">Bananas</span> are <em>great</em>!</span>' +
'	<span>Let’s eat one!</span>' +
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

    The MIT License (MIT)
    
    Copyright (c) 2014  Hauke Henningsen <sqrt@entless.org>
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
