import type { Metadata } from "next";
import "./globals.css";

const configuredBasePath = process.env.PUBLIC_BASE_PATH ?? "/";
const assetBasePath = configuredBasePath === "/" ? "" : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;

export const metadata: Metadata = {
  title: "像素工坊｜免费图片转换、压缩与尺寸调整",
  description: "在浏览器本地转换图片格式、压缩图片体积、修改分辨率，并一键裁剪常用封面尺寸。无需注册，保护隐私。",
  icons: { icon: `${assetBasePath}/favicon.svg`, shortcut: `${assetBasePath}/favicon.svg` },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "像素工坊｜图片处理，一步完成",
    description: "转换格式、压缩体积、修改尺寸和裁剪封面。无需注册，本地处理。",
    images: [{ url: `${assetBasePath}/og.png`, width: 1536, height: 910, alt: "像素工坊图片处理工具" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "像素工坊｜图片处理，一步完成",
    description: "转换、压缩、尺寸、裁剪，全部在浏览器本地完成。",
    images: [`${assetBasePath}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>;
}
