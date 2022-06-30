import { DomClass, createElementWithHtmlText } from 'paella-core/js/core/dom';
import Events, { bindEvent } from 'paella-core/js/core/Events';
import { resolveResourcePath, secondsToTime } from 'paella-core/js/core/utils';
import { loadPluginsOfType, unloadPluginsOfType } from './Plugin';

export function getCurrentFrame(sortedFrameList,time) {
	if (!sortedFrameList || sortedFrameList.length === 0) {
		return null;
	}
	
	let result = sortedFrameList[0];
	let prevTime = result.time;
	sortedFrameList.forEach(frame => {
		if (frame.time>prevTime && frame.time<Math.floor(time)) {
			result = frame;
			prevTime = result.time;
		}
	})
	
	return result;
}

function updateFrameThumbnail(offsetX,time) {
	let frame = getCurrentFrame(this.frameList, time);
	if (frame) {
		this._frameThumbnail.style.display = "block";
		const thumbWidth = this._frameThumbnail.getBoundingClientRect().width;
		const playbackBar = this.playbackBar;
		const { top, left, bottom, width, height } = playbackBar.getBoundingClientRect();
		const centerX = width / 2;
		
		this.frameThumbnail.style.bottom = `${ height }px`;
		if (centerX > offsetX) {
			this.frameThumbnail.style.left = `${ offsetX }px`;		
		}
		else {
			this.frameThumbnail.style.left = `${ offsetX - thumbWidth }px`;
		}
		
		const frameImage = resolveResourcePath(this.player, frame.url);
		const thumbImageContainer = this.frameThumbnail.getElementsByClassName("thumbnail-image")[0];
		const timeContainer = this.frameThumbnail.getElementsByClassName("thumbnail-time")[0];
		if (frameImage !== this._prevFrameImage) {
			thumbImageContainer.src = frameImage;
			thumbImageContainer.alt = frame.id;
			this._prevFrameImage = frameImage;
		}
		
		timeContainer.innerHTML = secondsToTime(time);
	}
}

function updateCanvas() {
	const backgroundContext = this._canvasContext[0];
	const foregroundContext = this._canvasContext[1];
	const width = this._canvas[0].clientWidth;
	const height = this._canvas[0].clientHeight;
	this._canvasPlugins.forEach(plugin => {
		plugin.drawForeground(foregroundContext, width, height);
		plugin.drawBackground(backgroundContext, width, height);
	})
	this._updateCanvas = false;
}

function updateHeight() {
	// TODO: Update bar height with this._minHeight, this._minHeightHover and this._isHover
	console.log("Update height");
	// Update fg canvas height
	// Update bg canvas height
	console.log("Is hover: " + this._isHover);
	updateCanvas.apply(this);
	this.requestUpdateCanvas();
}

export default class ProgressIndicator extends DomClass {
	constructor(player, parent) {
		const attributes = {
			"class": "progress-indicator"
		};
		const children = `
		<canvas class="progress-canvas canvas-layer-0"></canvas>
		<div class="progress-indicator-container">
			<div style="width: 0px;" class="progress-indicator-content"></div>
		</div>
		<canvas class="progress-canvas canvas-layer-1"></canvas>
		<div class="progress-indicator-timer">00:00</div>
		`;
		super(player, { attributes, children, parent });
		
		this._frameThumbnail = createElementWithHtmlText(`
			<div class="frame-thumbnail">
				<img src="" alt="" class="thumbnail-image" />
				<p class="thumbnail-time">00:00</p>
			</div>`, player.containerElement);
		this._frameThumbnail.style.display = "none";
		this._frameThumbnail.style.position = "absolute";
			
		this._canvas = [0,1].map(i => this.element.getElementsByClassName("progress-canvas")[i]);
		this._canvasContext = this._canvas.map(canvas => canvas.getContext("2d"));
		this._progressContainer = this.element.getElementsByClassName("progress-indicator-container")[0];
		this._progressIndicator = this.element.getElementsByClassName("progress-indicator-content")[0];
		this._progressTimer = this.element.getElementsByClassName("progress-indicator-timer")[0];
		
		this._frameList = player.videoManifest?.frameList;
		this._frameList?.sort((a,b) => a.time-b.time);
		
		this.onResize();
	
		let drag = false;
		const updateProgressIndicator = async (currentTime) => {
			const duration = await player.videoContainer.duration();
			const newWidth = currentTime * 100 / duration;
			this.progressIndicator.style.width = `${ newWidth }%`;
		}
		
		const positionToTime = async (pos) => {
			const barWidth = this.element.offsetWidth;
			const duration = await player.videoContainer.duration();
			return pos * duration / barWidth;
		}
	
		bindEvent(this.player, Events.TIMEUPDATE, async ({ currentTime }) => {
			if (!drag) {
				await updateProgressIndicator(currentTime);
				const formattedTime = secondsToTime(currentTime);
				this.progressTimer.innerHTML = formattedTime;
			}
		});
		
		bindEvent(this.player, Events.SEEK, async ({ prevTime, newTime }) => {
			if (!drag) {
				await updateProgressIndicator(newTime);
				const formattedTime = secondsToTime(newTime);
				this.progressTimer.innerHTML = formattedTime;
			}
		});
		
		bindEvent(this.player, Events.STOP, async () => {
			await updateProgressIndicator(0);
			const formattedTime = secondsToTime(0);
			this.progressTimer.innerHTML = formattedTime;
		})
		
		this.progressContainer.addEventListener("mousedown", async (evt) => {
			drag = true;
			const newTime = await positionToTime(evt.offsetX);
			await updateProgressIndicator(newTime);
		});

		this.progressContainer.addEventListener("mouseover", evt => {
			this._isHover = true;
			updateHeight.apply(this);
		});
		
		this.progressContainer._progressIndicator = this;
		this.progressContainer.addEventListener("mousemove", async (evt) => {
			const { isTrimEnabled, trimStart } = this.player.videoContainer;
			const offset = isTrimEnabled ? trimStart : 0;
			const newTime = await positionToTime(evt.offsetX);
			if (drag) {
				await updateProgressIndicator(newTime);
			}
			updateFrameThumbnail.apply(this, [evt.offsetX,newTime + offset]);
		});
		
		this.progressContainer.addEventListener("mouseup", async (evt) => {
			const newTime = await positionToTime(evt.offsetX);
			await updateProgressIndicator(newTime);
			await player.videoContainer.setCurrentTime(newTime);
			const formattedTime = secondsToTime(newTime);
			this.progressTimer.innerHTML = formattedTime;
			drag = false;
		});
		
		this.progressContainer.addEventListener("mouseleave", async (evt) => {
			if (drag) {
				const newTime = await positionToTime(evt.offsetX);
				await player.videoContainer.setCurrentTime(newTime);
				drag = false;
			}
			this.frameThumbnail.style.display = "none";
			this._isHover = false;
			updateHeight.apply(this);
		});

		const updateCanvassProcess = () => {
			this._updateCanvasTimer = setTimeout(() => {
				if (this._updateCanvas) {
					updateCanvas.apply(this);
				}
				updateCanvassProcess();
			}, 250);
		}
		this._updateCanvas = true;
		updateCanvassProcess();
	}

	requestUpdateCanvas() {
		this._updateCanvas = true;
	}
	
	async loadPlugins() {
		let minHeight = 0;
		let minHeightHover = 0;
		this._canvasPlugins = [];
		await loadPluginsOfType(this.player, "progressIndicator", async plugin => {
			this.player.log.debug(` Progress indicator plugin: ${ plugin.name }`);
			minHeight = minHeight < plugin.minHeight ? plugin.minHeight : minHeight;
			minHeightHover = minHeightHover < plugin.minHeightHover ? plugin.minHeightHover : minHeightHover;
			this._canvasPlugins.push(plugin);
		}, async plugin => {
			return await plugin.isEnabled();
		});

		this._minHeight = minHeight;
		this._minHeightHover = minHeightHover;
		updateHeight.apply(this);
	}

	async unloadPlugins() {
		this._canvasPlugins = [];
		await unloadPluginsOfType(this.player, "progressIndicator");
	}

	get playbackBar() {
		return this.element.parentElement;
	}
	
	get canvasLayer0() {
		return this._canvas[0];
	}
	
	get canvasLayer1() {
		return this._canvas[1];
	}
	
	get progressIndicator() {
		return this._progressIndicator;
	}
	
	get progressTimer() {
		return this._progressTimer;
	}
	
	get progressContainer() {
		return this._progressContainer;
	}
	
	get frameThumbnail() {
		return this._frameThumbnail;
	}
	
	get frameList() {
		return this._frameList;
	}
	
	onResize() {
		const size = {
			w: this.element.offsetWidth,
			h: this.element.offsetHeight
		};
		this._canvas.forEach(c => {
			c.width = size.w;
			c.height = size.h;
		});
		this.requestUpdateCanvas();
	}
}

