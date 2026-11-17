import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	outDir: "dist",
	modules: ["@wxt-dev/module-react"],
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	manifest: {
		default_locale: "en",
		name: "__MSG_extName__",
		description: "__MSG_extDescription__",
		permissions: [
			"tabs",
			"tabGroups",
			"storage",
			"alarms",
			"activeTab",
			"scripting",
			"webRequest",
			"unlimitedStorage",
			// 录屏：捕获当前标签页，并在 popup 关闭后由 offscreen 文档继续录制
			"tabCapture",
			"offscreen",
			// 新标签页里快捷方式和收藏的站点图标
			"favicon",
			// 新标签页展示浏览器书签（只读）
			"bookmarks",
			// 新标签页搜索框可选地搜索浏览历史（只在本机查询）
			"history",
		],
		// 录屏时摄像头小窗以 iframe 嵌入被录制的页面
		web_accessible_resources: [
			{ resources: ["camera.html"], matches: ["<all_urls>"], use_dynamic_url: true },
		],
		// 新标签页读取网站图标和联网搜索建议、AI 模型服务、Push 剪藏、X 书签抓取都要访问任意域名
		host_permissions: ["<all_urls>"],
		icons: {
			16: "icon/16.png",
			32: "icon/32.png",
			48: "icon/48.png",
			128: "icon/128.png",
		},
		action: {
			default_title: "__MSG_extName__",
			default_icon: {
				16: "icon/16.png",
				48: "icon/48.png",
				128: "icon/128.png",
			},
		},
	},
});
