import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Getting Started","description":"","frontmatter":{},"headers":[],"relativePath":"getting-started/index.md","filePath":"getting-started/index.md"}');
const _sfc_main = { name: "getting-started/index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="getting-started" tabindex="-1">Getting Started <a class="header-anchor" href="#getting-started" aria-label="Permalink to “Getting Started”">​</a></h1><p>Use these pages in order if you are new to PhaserForge.</p><h2 id="recommended-path" tabindex="-1">Recommended Path <a class="header-anchor" href="#recommended-path" aria-label="Permalink to “Recommended Path”">​</a></h2><ol><li><a href="./pattern-demo">Build the Pattern Demo</a></li><li><a href="./publish-to-github-pages">Publish to GitHub Pages</a></li></ol><h2 id="what-these-pages-assume" tabindex="-1">What These Pages Assume <a class="header-anchor" href="#what-these-pages-assume" aria-label="Permalink to “What These Pages Assume”">​</a></h2><ul><li>You can run PhaserForge locally.</li><li>You want a concrete first project instead of a broad feature tour.</li><li>You may need reference links back to editor workflow names and controls.</li></ul><p>The pages in this section are placeholders for the fuller guided tutorial content planned in later phases.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("getting-started/index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
