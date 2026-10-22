import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	outDir: "dist",
	modules: ["@wxt-dev/module-react"],
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	manifest: ({ mode }) => ({
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
		],
		// AI 整理所用的模型服务域名由用户填写，保存配置时再按域名单独申请
		optional_host_permissions: ["*://*/*"],
		// push-content.com：剪藏 Push 分享页正文时由后台拉取
		host_permissions: [
			`${new URL(loadEnv(mode, process.cwd(), "WXT_").WXT_API_URL!).origin}/*`,
			"https://push-content.com/*",
		],
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
	}),
});
