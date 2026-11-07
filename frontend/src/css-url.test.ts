import assert from "node:assert/strict";
import { test } from "node:test";
import { cssUrl } from "./css-url.ts";

test("a plain address is quoted", () => {
  assert.equal(cssUrl("/api/media_player_proxy/x?token=abc"), 'url("/api/media_player_proxy/x?token=abc")');
});

test("spaces, parentheses and semicolons stay inside the quotes (#384)", () => {
  assert.equal(cssUrl("/a b/c(1);d.jpg"), 'url("/a b/c(1);d.jpg")');
});

test("quotes, backslashes and line breaks are escaped so the string cannot end early", () => {
  const bs = String.fromCharCode(92);
  assert.equal(cssUrl('/x"); color:red; ("'), `url("/x${bs}22 ); color:red; (${bs}22 ")`);
  assert.equal(cssUrl(`/a${bs}b`), `url("/a${bs}5c b")`);
  assert.equal(cssUrl("/a" + String.fromCharCode(10) + "b"), `url("/a${bs}a b")`);
});
