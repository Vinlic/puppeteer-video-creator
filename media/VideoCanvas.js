import VideoConfig from "../preprocessor/video/VideoConfig.js";
import ____MP4Demuxer from "./MP4Demuxer.js";

import innerUtil from "../lib/inner-util.js";

const ____util = innerUtil();

/**
 * 视频画布
 */
export default class VideoCanvas {

    /** @type {string} - 视频URL */
    url;
    /** @type {string} - 视频格式 */
    format;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {Object} - 视频信息配置对象 */
    config;
    /** @type {number} - 帧索引 */
    frameIndex = 0;
    /** @type {number} - 已解码帧索引 */
    decodedFrameIndex = 0;
    /** @type {number} - 已解码蒙版帧索引 */
    decodedMaskFrameIndex = 0;
    /** @type {number} - 当前播放时间点（毫秒） */
    currentTime = 0;
    /** @type {VideoFrame[]} - 已解码视频帧队列 */
    frames = [];
    /** @type {VideoFrame[]} - 已解码蒙版视频帧队列 */
    maskFrames = [];
    /** @type {HTMLCanvasElement} - 画布元素 */
    canvas = null;
    /** @type {CanvasRenderingContext2D}  - 画布2D渲染上下文*/
    canvasCtx = null;
    /** @type {OffscreenCanvas} - 离屏画布对象 */
    offscreenCanvas;
    /** @type {OffscreenCanvasRenderingContext2D} - 离屏2D画布渲染上下文 */
    offscreenCanvasCtx;
    /** @type {number} - 偏移时间量 */
    offsetTime = 0;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;
    /** @type {VideoDecoder} - 视频解码器 */
    decoder = null;
    /** @type {VideoDecoder} - 蒙版视频解码器 */
    maskDecoder = null;
    /** @type {____MP4Demuxer} - 视频解复用器 */
    demuxer = null;
    /** @type {____MP4Demuxer} - 蒙版视频解复用器 */
    maskDemuxer = null;
    /** @type {number} - 等待视频帧下标 */
    waitFrameIndex = null;
    /** @type {number} - 等待蒙版视频帧下标 */
    waitMaskFrameIndex = null;
    /** @type {____MP4Demuxer} - 等待视频帧回调 */
    waitFrameCallback = null;
    /** @type {____MP4Demuxer} - 等待蒙版视频帧回调 */
    waitMaskFrameCallback = null;

    /**
     * 构造函数
     * 
     * @param {Object} options - 视频配置选项
     * @param {string} options.url - 视频URL
     * @param {number} options.startTime - 开始播放时间点（毫秒）
     * @param {number} options.endTime - 结束播放时间点（毫秒）
     * @param {string} [options.format] - 视频格式（mp4/webm）
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {boolean} [options.autoplay] - 是否自动播放
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {boolean} [options.retryFetchs=2] - 重试下载次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        const u = ____util;
        u.assert(u.isObject(options), "VideoCanvas options must be Object");
        const { url, startTime, endTime, format, seekStart, seekEnd, autoplay, loop, muted, retryFetchs, ignoreCache } = options;
        u.assert(u.isString(url), "url must be string");
        u.assert(u.isNumber(startTime), "startTime must be number");
        u.assert(u.isNumber(endTime), "endTime must be number");
        u.assert(u.isUndefined(format) || u.isString(format), "format must be string");
        u.assert(u.isUndefined(seekStart) || u.isNumber(seekStart), "seekStart must be number");
        u.assert(u.isUndefined(seekEnd) || u.isNumber(seekEnd), "seekEnd must be number");
        u.assert(u.isUndefined(autoplay) || u.isBoolean(autoplay), "autoplay must be boolean");
        u.assert(u.isUndefined(loop) || u.isBoolean(loop), "loop must be boolean");
        u.assert(u.isUndefined(muted) || u.isBoolean(muted), "muted must be boolean");
        u.assert(u.isUndefined(retryFetchs) || u.isNumber(retryFetchs), "retryFetchs must be number");
        u.assert(u.isUndefined(ignoreCache) || u.isBoolean(ignoreCache), "ignoreCache must be boolean");
        this.url = url;
        this.startTime = startTime;
        this.endTime = endTime;
        this.format = format;
        this.seekStart = u.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.autoplay = autoplay;
        this.loop = u.defaultTo(loop, false);
        this.muted = u.defaultTo(muted, false);
        this.retryFetchs = u.defaultTo(retryFetchs, 2);
        this.ignoreCache = u.defaultTo(ignoreCache, false);
    }

    /**
     * 绑定画布元素
     * 
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     * @param {boolean} [options.imageSmoothingEnabled="high"] - 抗锯齿强度
     */
    bind(canvas, options = {}) {
        const { alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high" } = options;
        this.canvas = canvas;
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", { alpha });
        // 设置抗锯齿开关
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
        // 设置抗锯齿强度
        this.canvasCtx.imageSmoothingQuality = imageSmoothingQuality;
    }

    canPlay(time) {
        if (this.destoryed) return;
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;  //如果当前时间超过元素开始结束时间则判定未不可播放
        return true;
    }

    /**
     * 加载视频
     */
    async load() {
        try {
            console.time();
            const response = await captureCtx.fetch("video_preprocess", {
                method: "POST",
                body: JSON.stringify(this._exportConfig()),
                retryFetchs: 0
            });
            console.timeEnd();
            if (!response) {
                this.destory();
                return false;
            }
            const {
                buffer,
                maskBuffer,
                hasMask
            } = this._unpackData(await response.arrayBuffer());
            const {
                demuxer,
                decoder,
                config
            } = await this._createDecoder(buffer, {
                hasMask,
                onFrame: this._emitNewFrame.bind(this),
                onError: err => console.error(err)
            });
            // 预分配视频帧数组
            this.frames = new Array(config.frameCount);
            this.demuxer = demuxer;
            this.decoder = decoder;
            this.config = config;
            if (hasMask) {
                // 预分配蒙版视频帧数组
                this.maskFrames = new Array(config.frameCount);
                // 初始化用于蒙版抠图的离屏画布
                this._initOffscreenCanvas();
                const {
                    demuxer: maskDemuxer,
                    decoder: maskDecoder,
                    config: maskConfig
                } = await this._createDecoder(maskBuffer, {
                    onFrame: this._emitNewMaskFrame.bind(this),
                    onError: err => console.error(err)
                });
                this.maskDemuxer = maskDemuxer;
                this.maskDecoder = maskDecoder;
                ____util.assert(maskConfig.codedWidth == config.codedWidth, `Mask video codedWidth (${maskConfig.codedWidth}) is inconsistent with the original video codedWidth (${config.codedWidth})`);
                ____util.assert(maskConfig.codedHeight == config.codedHeight, `Mask video codedHeight (${maskConfig.codedHeight}) is inconsistent with the original video codedHeight (${config.codedHeight})`);
                ____util.assert(maskConfig.frameCount == config.frameCount, `Mask video frameCount (${maskConfig.frameCount}) is inconsistent with the original video frameCount (${config.frameCount})`);
                ____util.assert(maskConfig.fps == config.fps, `Mask video fps (${maskConfig.fps}) is inconsistent with the original video fps (${config.fps})`);
            }
            return true;
        }
        catch (err) {
            console.log(err);
            this.destory();
            return false;
        }
    }

    isReady() {
        return !!this.decoder;
    }

    async seek(time) {
        // 已销毁不可索引
        if (this.destoryed) return;
        // 计算当前帧的下标
        const frameIndex = Math.floor(time / this.config.frameInterval);
        // 如果当前时间点帧下标和上次一样不做处理
        if (this.frameIndex === frameIndex) return;
        console.log(`${frameIndex}/${this.config.frameCount}`);
        if (frameIndex > 594)
            return;
        const frame = await this._acquireFrame(frameIndex);
        let maskFrame = null;
        if (this.config.hasMask)
            maskFrame = await this._acquireMaskFrame(frameIndex);
        const { displayWidth, displayHeight } = frame;
        if (maskFrame) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.offscreenCanvasCtx.drawImage(maskFrame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            const maskData = this.offscreenCanvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height)
            for (let i = 0; i < maskData.data.length; i += 4)
                maskData.data[i + 3] = maskData.data[i];
            this.offscreenCanvasCtx.putImageData(maskData, 0, 0);
            this.canvasCtx.drawImage(this.offscreenCanvas, 0, 0);
            this.canvasCtx.globalCompositeOperation = 'source-in';
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            this.canvasCtx.globalCompositeOperation = 'source-over';
        }
        else
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
        frame.close();
        if (maskFrame) {
            maskFrame.close();
            this.maskFrames[frameIndex] = null;
        }
        this.frames[frameIndex] = null;
        this.frameIndex = frameIndex;
    }

    isEnd() {

    }

    canDestory(time) {
        // 已销毁则避免重复销毁
        if (this.destoryed) return false;
        // 返回当前时间是否大于结束实际
        return time >= this.endTime;
    }

    reset() {

    }

    destory() {
        this.decoder && this.decoder.close();
        this.decoder = null;
        this.demuxer = null;
        this.reset();
        this.destoryed = true;
    }

    /**
     * 初始化离屏画布
     * 
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     * @param {boolean} [options.imageSmoothingEnabled="high"] - 抗锯齿强度
     */
    _initOffscreenCanvas(options = {}) {
        const { alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high" } = options;
        // 创建实验性的离屏画布
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        // 获取2D渲染上下文
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d", { alpha });
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
        this.canvasCtx.imageSmoothingQuality = imageSmoothingQuality;
    }

    async _acquireFrame(frameIndex) {
        if (this.frames[frameIndex])
            return this.frames[frameIndex];
        let timer;
        await Promise.race([
            new Promise(resolve => {
                this.waitFrameIndex = frameIndex;
                this.waitFrameCallback = resolve;
            }),
            new Promise((_, reject) => ____setTimeout(() => reject(new Error("Acquire video frame timeout (30s)")), 30000))
        ]);
        ____clearTimeout(timer);
        return this.frames[frameIndex];
    }

    async _acquireMaskFrame(frameIndex) {
        if (this.maskFrames[frameIndex])
            return this.maskFrames[frameIndex];
        let timer;
        await Promise.race([
            new Promise(resolve => {
                this.waitMaskFrameIndex = frameIndex;
                this.waitMaskFrameCallback = resolve;
            }),
            new Promise((_, reject) => ____setTimeout(() => reject(new Error("Acquire mask video frame timeout (30s)")), 30000))
        ]);
        ____clearTimeout(timer);
        return this.maskFrames[frameIndex];
    }

    /**
     * 通知新视频帧产生
     * 
     * @param {VideoFrame} frame - 视频帧
     */
    _emitNewFrame(frame) {
        frame.index = this.decodedFrameIndex;
        this.frames[frame.index] = frame;
        if (this.waitFrameCallback && this.waitFrameIndex == frame.index) {
            const fn = this.waitFrameCallback;
            this.waitFrameIndex = null;
            this.waitFrameCallback = null;
            fn();
        }
        this.decodedFrameIndex++;
    }

    /**
     * 通知新蒙版视频帧产生
     * 
     * @param {VideoFrame} frame - 视频帧
     */
    _emitNewMaskFrame(frame) {
        frame.index = this.decodedMaskFrameIndex;
        this.maskFrames[frame.index] = frame;
        if (this.waitMaskFrameCallback && this.waitMaskFrameIndex == frame.index) {
            const fn = this.waitMaskFrameCallback;
            this.waitMaskFrameIndex = null;
            this.waitMaskFrameCallback = null;
            fn();
        }
        this.decodedMaskFrameIndex++;
    }

    /**
     * 创建解码器
     * 
     * @param {Uint8Array} data - 视频数据
     * @param {Object} options - 解码器选项
     * @param {boolean} [hasMask] - 是否有蒙版
     * @param {Function} onFrame - 视频帧回调
     * @param {Function} onError - 错误回调
     * @returns {Object} - 解码器和配置对象
     */
    async _createDecoder(data, options = {}) {
        const u = ____util;
        const { hasMask, onFrame, onError } = options;
        u.assert(u.isUint8Array(data), "data must be Uint8Array");
        u.assert(u.isUndefined(hasMask) || u.isBoolean(hasMask), "hasMask must be boolean");
        u.assert(u.isFunction(onFrame), "onFrame must be Function");
        u.assert(u.isFunction(onError), "onError must be Function");
        const decoder = new VideoDecoder({
            output: onFrame.bind(this),
            error: onError.bind(this)
        });
        const demuxer = new ____MP4Demuxer();
        let timer;
        const waitConfigPromise = Promise.race([
            new Promise((resolve, reject) => {
                demuxer.onConfig(config => {
                    resolve(config);
                    decoder.configure({
                        // 视频信息配置
                        ...config,
                        // 指示优先使用硬件加速解码
                        hardwareAcceleration: "prefer-hardware",
                        // 关闭延迟优化，让解码器批量处理解码，降低负载
                        optimizeForLatency: false
                    });
                });
                demuxer.onError(reject);
            }),
            new Promise((_, reject) => timer = ____setTimeout(() => reject(new Error(`Video buffer demux timeout (60s)`)), 60000))
        ]);
        ____clearTimeout(timer);
        demuxer.onChunk(chunk => decoder.decode(chunk));
        demuxer.load(data);
        // 等待解码配置
        const config = await waitConfigPromise;
        // 检查视频解码器是否支持当前配置
        await VideoDecoder.isConfigSupported(config);
        config.hasMask = hasMask;
        return {
            config,
            decoder,
            demuxer
        };
    }

    /**
     * 导出视频配置
     * 
     * @returns {VideoConfig} - 视频配置
     */
    _exportConfig() {
        return {
            url: this.url,
            format: this.format,
            startTime: this.startTime,
            endTime: this.endTime,
            seekStart: this.seekStart,
            seekEnd: this.seekEnd,
            autoplay: this.autoplay,
            loop: this.loop,
            muted: this.muted,
            retryFetchs: this.retryFetchs,
            ignoreCache: this.ignoreCache
        };
    }

    /**
     * 解包数据
     * 从封装的ArrayBuffer中提取原始数据对象
     * 
     * @param {ArrayBuffer} packedData - 已封装数据
     * @returns {Object} - 原始数据对象
     */
    _unpackData(packedData) {
        const dataView = new DataView(packedData);
        let delimiterIndex = -1;
        for (let i = 0; i < dataView.byteLength; i++) {
            if (dataView.getUint8(i) === '!'.charCodeAt(0)) {
                delimiterIndex = i;
                break;
            }
        }
        if (delimiterIndex === -1)
            throw new Error("Invalid data format: header delimiter not found");
        const lengthBytes = new Uint8Array(dataView.buffer, 0, delimiterIndex);
        const objLength = parseInt(String.fromCharCode(...lengthBytes));
        if (isNaN(objLength) || objLength <= 0 || objLength > dataView.byteLength - delimiterIndex - 1)
            throw new Error("Invalid data format: Invalid data length");
        const objBytes = new Uint8Array(dataView.buffer, delimiterIndex + 1, objLength);
        const obj = JSON.parse(new TextDecoder("utf-8").decode(objBytes));
        const bufferOffset = delimiterIndex + 1 + objLength;
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key][0] === "buffer") {
                const [_, start, end] = obj[key];
                obj[key] = new Uint8Array(dataView.buffer.slice(bufferOffset + start, bufferOffset + end));
            }
        }
        return obj;
    }

}