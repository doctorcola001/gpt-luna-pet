# gpt-luna-pet

LUNA 桌宠项目正式仓库名称为 **gpt-luna-pet**，设置界面仍保留“LUNA 桌宠”的显示名。

Windows 10/11 x64 透明桌宠，使用 Electron 构建。当前开放 B、C 两套形态，A 形态仍处于停用归档状态。

## 下载

在 [Releases](https://github.com/doctorcola001/gpt-luna-pet/releases) 下载 Windows x64 版本：

- **安装版**：下载 `LUNA-1.3.1-setup.exe`，运行安装程序。
- **便携版**：下载 `LUNA-1.3.1-portable.zip`，解压后保持整个程序文件夹完整，双击其中的 `LUNA桌宠.exe`。

## 功能概览

- 透明无边框桌宠，置顶、可拖动、可开关设置面板。
- B 形态：发呆、24 帧扇翅、挠头、盖被子睡觉；清醒时单击会触发或推进思考气泡。
- C 形态：原生杯面立绘、独立上下压缩 Q 弹、持续移动、循环歌词气泡。
- 思考气泡是粗描边云朵形，文字为 20px 加粗深紫色，以渐变+轻微回弹入场；B / C 内容由外置 `thoughts.json` 提供，可人工修改。
- B 睡觉时单击只喷 Z 字，不弹气泡、不触发变身；Z 为 36–54px 白字紫描边，最远 300px。
- B 睡觉时显示闹钟按钮：点击后玩具锤砸下，以“碰！”大字遮挡切换，醒来回到站立发呆。
- B/C 气泡支持顺序或随机播放；C 的弹动方式可独立选择。
- 整体默认缩放 85%，可在 50%–100% 间调整，100% 为原生尺寸。
- 单击有 15% 概率随机变身，并随机选择状态分支。
- 系统托盘支持显示/隐藏与退出。

## 快速运行

开发环境需要 Node.js 与项目依赖：

```bat
npm install
npm start
```

如果已经生成运行目录，可直接双击：

```text
dist\LUNA桌宠-win64\LUNA桌宠.exe
```

或运行 `start-pet.cmd`。桌宠目录必须保持完整，不能只单独拷走 exe。

## 思考气泡配置

安装后，`thoughts.json` 位于程序文件夹内，与 `LUNA桌宠.exe` 同级。用文本编辑器按行修改 B、C 数组即可：

```json
{
  "B": ["啊吧啊吧", "GPT-6-Luna已连接"],
  "C": ["哦耶耶", "桃花~谢了有玫瑰"]
}
```

修改后在设置中点击“保存并应用”可重新读取，也可以重启桌宠。安装包升级时不会覆盖已有 `thoughts.json`。

## 测试

```bat
node tests\core.test.js
```

Electron 端到端测试位于 `tests\browser.test.js`，需要 Playwright，并使用本机 Electron 39 运行。

## 安装包

安装脚本位于 `installer\LUNA.iss`。使用 Inno Setup 6 编译：

```bat
"D:\Inno Setup 6\ISCC.exe" installer\LUNA.iss
```

默认按当前用户安装到 `%LOCALAPPDATA%\Programs\LUNA桌宠`，创建开始菜单、桌面快捷方式及卸载器。

## 目录说明

- `main.js` / `preload.js`：Electron 主进程与受控 IPC。
- `app.js` / `core.js`：桌宠状态、气泡、动画与移动寻路。
- `styles.css` / `index.html`：透明窗口界面。
- `assets/sprites`：运行立绘、B 扇翅八帧。
- `assets/audio/duck-squeak.mp3`：小黄鸭捏捏点击音（用户提供原音）。
- `assets/source`：手工修复的 B/C 原图存档。
- `assets/generated`：生成图与切帧参考。
- `assets/rejected`：明确废弃的素材，不参与运行。
- `tools`：素材切帧脚本。
- `tests`：核心与 Electron 交互测试。
- `installer`：Inno Setup 安装脚本。

更完整的实现和构建说明见 `docs/开发说明.md`，迭代过程见 `docs/开发日志.md`。

## 鸣谢

感谢以下工具和伙伴为项目提供助力：

- GPT Image 2
- GPT Image 2.5 Flare
- GPT Image 2.5 Sunburst
- DeepSeek V4.1 Flash（大肥鱼）
- GPT 6.1 Terra（小龙）
- Gemini 3.7 Flash（哈基米）
- Nano Banana
- Adobe Photoshop

## 许可

本项目中由项目作者拥有并有权授权的内容，以 [知识共享署名-非商业性使用 4.0 国际许可协议（CC BY-NC 4.0）](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans)发布。使用者须署名，且不得用于商业目的；分享或改编时还须遵守该协议的其他条款。

第三方软件、素材及其商标的权利和许可不受上述声明改变，使用时请遵循各自适用的条款。CC BY-NC 4.0 包含非商业限制，不属于开源软件许可证。
