import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"PhaserForge User Guide","description":"","frontmatter":{},"headers":[],"relativePath":"index.md","filePath":"index.md"}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="phaserforge-user-guide" tabindex="-1">PhaserForge User Guide <a class="header-anchor" href="#phaserforge-user-guide" aria-label="Permalink to “PhaserForge User Guide”">​</a></h1><p>This guide is the first-pass docs home for PhaserForge. It is intended to turn the planning workflow notes into a usable, step-by-step path for first-time users.</p><h2 id="start-here" tabindex="-1">Start Here <a class="header-anchor" href="#start-here" aria-label="Permalink to “Start Here”">​</a></h2><ul><li><a href="./getting-started/">Getting Started Overview</a></li><li><a href="./getting-started/pattern-demo">Build the Pattern Demo</a></li><li><a href="./getting-started/publish-to-github-pages">Publish to GitHub Pages</a></li><li><a href="./reference/editor-workflows">Editor Workflow Reference</a></li></ul><h2 id="scope" tabindex="-1">Scope <a class="header-anchor" href="#scope" aria-label="Permalink to “Scope”">​</a></h2><p>The first documentation phase focuses on:</p><ul><li>a guided <code>pattern_demo</code> walkthrough</li><li>a guided GitHub Pages publish walkthrough</li><li>a reference section tied to the editor workflow inventory</li></ul><p>Images and generated reference content will be added in later phases.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
