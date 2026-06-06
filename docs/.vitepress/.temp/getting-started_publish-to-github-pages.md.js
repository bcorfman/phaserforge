import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Publish to GitHub Pages","description":"","frontmatter":{},"headers":[],"relativePath":"getting-started/publish-to-github-pages.md","filePath":"getting-started/publish-to-github-pages.md"}');
const _sfc_main = { name: "getting-started/publish-to-github-pages.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="publish-to-github-pages" tabindex="-1">Publish to GitHub Pages <a class="header-anchor" href="#publish-to-github-pages" aria-label="Permalink to “Publish to GitHub Pages”">​</a></h1><p>This page will become the publish walkthrough for taking a finished PhaserForge demo and publishing it to GitHub Pages from the Cloud pane.</p><h2 id="planned-structure" tabindex="-1">Planned Structure <a class="header-anchor" href="#planned-structure" aria-label="Permalink to “Planned Structure”">​</a></h2><ol><li>Sign in to PhaserForge</li><li>Connect GitHub</li><li>Open the Cloud pane</li><li>Enter the project title and repository name</li><li>Run publish precheck</li><li>Publish and confirm any overwrite/update prompt</li><li>Verify the resulting Pages URL</li></ol><h2 id="source-material" tabindex="-1">Source Material <a class="header-anchor" href="#source-material" aria-label="Permalink to “Source Material”">​</a></h2><ul><li><a href="./../reference/editor-workflows">Editor Workflow Reference</a></li><li><code>W16</code> Cloud Publish Loop</li><li><code>A63</code> through <code>A66</code> account, GitHub, and publish workflows</li></ul><h2 id="phase-1-status" tabindex="-1">Phase 1 Status <a class="header-anchor" href="#phase-1-status" aria-label="Permalink to “Phase 1 Status”">​</a></h2><p>This is a scaffold page. In later phases it will gain:</p><ul><li>a user-facing walkthrough</li><li>close-up screenshots of the Cloud pane</li><li>troubleshooting for common publish failures</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("getting-started/publish-to-github-pages.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const publishToGithubPages = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  publishToGithubPages as default
};
