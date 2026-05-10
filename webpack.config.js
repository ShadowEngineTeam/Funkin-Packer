import path from "path";
import webpack from "webpack";
import CopyPlugin from "copy-webpack-plugin";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let entry = ["./src/client/index.tsx"];
let plugins = [];
let debug = true;
let devtool = debug ? "eval-source-map" : "source-map";
let profiler = debug;

entry.unshift("core-js/stable");

export default (env, argv) => {
  const prod = argv?.mode === "production";
  const haxe = env?.haxe === true || env?.haxe === "true";
  const haxePlatform = env?.haxePlatform;
  const mode = prod ? "production" : "development";

  const archMacroMap = {
    "x86_64": "HXCPP_M64",
    "x86": "HXCPP_M32",
    "arm64": "HXCPP_ARM64",
    "armv7": "HXCPP_ARMV7",
  };
  const arch = env?.arch || "x86_64";
  const hxcppArchDefine = archMacroMap[arch];

  plugins.push(
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(mode),
      PROFILER: JSON.stringify(profiler),
      DEBUG: JSON.stringify(!prod),
      PLATFORM: JSON.stringify("web"),
    })
  );

  const outputPath = path.resolve(__dirname, "dist");

  if (prod) {
    plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: "src/client/resources",
            to: haxe ? "assets" : "",
            globOptions: { ignore: ["**/.DS_Store"] },
          },
        ],
      })
    );

    if (haxe) {
      plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "src/haxe",
              to: "",
              globOptions: { ignore: ["**/.DS_Store"] },
            },
            {
              from: "icons",
              to: "icons",
              globOptions: { ignore: ["**/.DS_Store"] },
            },
          ],
        })
      );

      const hxmlPath = path.resolve(outputPath, "compile.hxml");
      const hxmlLines = [];

      hxmlLines.push("--cpp out");
      hxmlLines.push("--main Main");
      hxmlLines.push("--dce full");
      hxmlLines.push("--macro macros.AssetsMacro.build()");

      const desktopPlatforms = ["windows", "linux", "mac", "macos"];
      const mobilePlatforms = ["android", "ios", "iphone", "iphoneos"];

      if (desktopPlatforms.includes(haxePlatform)) {
        hxmlLines.push("--library hxwebview");
        hxmlLines.push("-D desktop");
        hxmlLines.push("-D no_console");
      } else if (mobilePlatforms.includes(haxePlatform)) {
        hxmlLines.push("--library extension-webview");
        hxmlLines.push("-D mobile");
      }

      if (haxePlatform === "windows") {
        hxmlLines.push("-D windows");
        hxmlLines.push("-D resourceFile=..\\icon.rc");
      }
      if (haxePlatform === "linux") hxmlLines.push("-D linux");
      if (haxePlatform === "mac" || haxePlatform === "macos") {
        hxmlLines.push("-D mac");
        hxmlLines.push("-D macos");
      }
      if (haxePlatform === "android") hxmlLines.push("-D android");
      if (haxePlatform === "ios" || haxePlatform === "iphone" || haxePlatform === "iphoneos") {
        hxmlLines.push("-D ios");
        hxmlLines.push("-D iphone");
        hxmlLines.push("-D iphoneos");
      }

      if (hxcppArchDefine) hxmlLines.push(`-D ${hxcppArchDefine}`);

      hxmlLines.push("-D HXCPP_CHECK_POINTER");
      hxmlLines.push("-D HXCPP_STACK_LINE");
      hxmlLines.push("-D HXCPP_STACK_TRACE");
      hxmlLines.push("-D HXCPP_CATCH_SEGV");

      fs.mkdirSync(outputPath, { recursive: true });
      fs.writeFileSync(hxmlPath, hxmlLines.join("\n"));
    }

    debug = false;
  } else {
    entry.push("webpack-dev-server/client?http://localhost:4000");
    plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: "src/client/resources",
            to: "",
            globOptions: { ignore: ["**/.DS_Store"] },
          },
        ],
      })
    );
  }

  const config = {
    entry,
    output: {
      path: outputPath,
      filename: haxe ? "assets/static/js/index.js" : "static/js/index.js",
    },
    devServer: {
      static: "./dist",
    },
    devtool,
    target: "web",
    mode,
    module: {
      noParse: /.*[/\\]bin[/\\].+\.js/,
      rules: [
        { test: /\.tsx$/, use: [{ loader: "ts-loader" }], exclude: /node_modules/ },
        { test: /\.ts$/, use: [{ loader: "ts-loader" }], exclude: /node_modules/ },
        {
          test: /.jsx?$/,
          include: [path.resolve(__dirname, "src")],
          use: [{ loader: "babel-loader", options: { presets: ["@babel/preset-react", "@babel/preset-env"] } }],
        },
        { test: /\.js$/, include: [path.resolve(__dirname, "src")], use: [{ loader: "babel-loader", options: { presets: ["@babel/preset-env"] } }] },
        { test: /\.(html|htm)$/, use: [{ loader: "dom" }] },
        { test: /\.mst$/, use: [{ loader: "raw-loader" }] },
      ],
    },
    optimization: { minimize: prod, usedExports: true },
    plugins,
    resolve: {
      alias: {
        platform: path.resolve(__dirname, "./src/client/platform/web"),
        api: path.resolve(__dirname, "./src/api"),
        client: path.resolve(__dirname, "./src/client"),
        TypedObserver: path.resolve(__dirname, "./src/client/TypedObserver"),
      },
      extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
  };

  return config;
};
