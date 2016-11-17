# coding=utf-8
from __future__ import absolute_import

import octoprint.plugin

class viewstl(octoprint.plugin.StartupPlugin,
        octoprint.plugin.TemplatePlugin,
        octoprint.plugin.AssetPlugin):
             
  def on_after_startup(self):
    self._logger.info("ViewSTL loaded!")

  def get_template_configs(self):
    return []

  def get_assets(self):
    return dict(
      js=["js/three.min.js","js/OrbitControls.js","js/Detector.js", "ViewSTL.js"]
    )

__plugin_name__ = "ViewSTL"
__plugin_implementation__ = viewstl()
