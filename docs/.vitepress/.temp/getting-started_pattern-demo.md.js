import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Pattern Demo","description":"","frontmatter":{},"headers":[],"relativePath":"getting-started/pattern-demo.md","filePath":"getting-started/pattern-demo.md"}');
const _sfc_main = { name: "getting-started/pattern-demo.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="pattern-demo" tabindex="-1">Pattern Demo <a class="header-anchor" href="#pattern-demo" aria-label="Permalink to “Pattern Demo”">​</a></h1><p>This page will become the primary first-time-user walkthrough for recreating the <code>pattern_demo</code> project in PhaserForge.</p><h2 id="planned-structure" tabindex="-1">Planned Structure <a class="header-anchor" href="#planned-structure" aria-label="Permalink to “Planned Structure”">​</a></h2><ol><li>Start a new empty scene</li><li>Import the ship asset</li><li>Create and name the seven sprites</li><li>Position the sprites with snap and layout tools</li><li>Add text labels</li><li>Attach movement patterns</li><li>Verify the demo in Play mode</li><li>Save the YAML</li></ol><h2 id="source-material" tabindex="-1">Source Material <a class="header-anchor" href="#source-material" aria-label="Permalink to “Source Material”">​</a></h2><ul><li><code>.plans/pattern_demo_workflow.md</code></li><li><a href="./../reference/editor-workflows">Editor Workflow Reference</a></li></ul><h2 id="phase-1-status" tabindex="-1">Phase 1 Status <a class="header-anchor" href="#phase-1-status" aria-label="Permalink to “Phase 1 Status”">​</a></h2><p>This is a scaffold page. In later phases it will gain:</p><ul><li>step-by-step instructions</li><li>panel-level screenshots</li><li>success checks after each step</li><li>links to generated workflow anchors</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("getting-started/pattern-demo.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const patternDemo = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  patternDemo as default
};
