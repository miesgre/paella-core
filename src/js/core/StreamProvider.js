import PlayerResource from 'paella-core/js/core/PlayerResource';
import { getVideoPlugin } from 'paella-core/js/core/VideoPlugin';
import Events, { triggerEvent } from 'paella-core/js/core/Events';

export default class SteramProvider extends PlayerResource {
	constructor(player, videoContainer) {
		super(player, videoContainer);
		this._videoContainer = videoContainer;
		this._streamData = null;
		this._streams = null;
		this._players = [];
		
		this._streamSyncTimer = null;
		
		this._trimming = {
			enabled: false,
			start: 0,
			end: 0
		}
	}
	
	async load(streamData) {
		this._streamData = streamData;
		this._streams = {};
		
		console.debug("Finding compatible video plugins");
		
		// Find video plugins for each stream
		this._streamData.forEach(stream => {
			const videoPlugin = getVideoPlugin(this.player, stream);
			if (!videoPlugin) {
				throw Error(`Incompatible stream type: ${ stream.content }`);
			}
			
			this._streams[stream.content] = {
				stream,
				videoPlugin
			}
		})
		
		let videoEndedEventTimer = null;
		for (const content in this._streams) {
			const s = this._streams[content];
			s.player = await s.videoPlugin.getVideoInstance(this._videoContainer);
			await s.player.load(s.stream);			
			s.player.onVideoEnded(() => {
				if (videoEndedEventTimer === null) {
					triggerEvent(this.player, Events.ENDED);
					videoEndedEventTimer = setTimeout(() => {
						videoEndedEventTimer = null;
					}, 2000);
				}
			})
			this._players.push(s.player);
		}
	}
	
	get players() {
		return this._players;
	}
	
	// This is the raw streamData loaded from the video manifest
	get streamData() {
		return this._streamData;
	}
	
	// This property stores the available streams, indexed by the content identifier, and contains the
	// stream data, the video plugin and the player, for each content identifier.
	get streams() {
		return this._streams;
	}
	
	startStreamSync() {
		const setupSyncTimer = () => {
			// TODO: sync
			// TODO: Event.ENDED
			
			const currentTime = this._players[0].currentTimeSync;
			
			// Check trimming
			if (this._trimming.enabled && this._trimming.end<=currentTime) {
				// TODO: end video	
			}
			else {				
				triggerEvent(this.player, Events.TIMEUPDATE, { currentTime });
				this._timeupdateTimer = setTimeout(() => {
					setupSyncTimer();	
				}, 250);
			}
		}
		setupSyncTimer();
	}
	
	stopStreamSync() {
		if (this._timeupdateTimer) {
			clearTimeout(this._timeupdateTimer);
		}
	}
	
	executeAction(fnName, params = []) {
		// Important: this implementation must be done using promises instead of async/await, due to
		// a bug in babel that causes that the resulting array may not be available when the async function
		// is completed.
		if (!Array.isArray(params)) {
			params = [params];
		}
		return new Promise((resolve) => {
			let res = [];
			let p = [];
			this.players.forEach(player => {
				p.push(new Promise(innerResolve => {
					player[fnName](...params).then(r => {
						res.push(r);
						innerResolve();
					})
				}));
			})
			
			Promise.all(p).then(() => resolve(res));
		})
	}
	
	async play() {
		this.startStreamSync();
		const result = await this.executeAction("play");
		return result;
	}

	async pause() {
		this.stopStreamSync();
		const result = await this.executeAction("pause");
		return result;
	}
	
	async stop() {
		this.stopStreamSync()
		await this.executeAction("pause");
		await this.executeAction("setCurrentTime", 0);
	}
	
	async paused() {
		return (await this.executeAction("paused"))[0];
	}

	async setCurrentTime(t) {
		const prevTime = (await this.executeAction("currentTime"))[0];
		const result = (await this.executeAction("setCurrentTime", [t]))[0];
		const newTime = (await this.executeAction("currentTime"))[0];
		return { result, prevTime, newTime };
	}
	
	async currentTime() {
		return (await this.executeAction("currentTime"))[0];
	}
	
	async volume() {
		return (await this.executeAction("volume"))[0];
	}
	
	async setVolume(v) {
		const result = (await this.executeAction("setVolume",[v]))[0];
		return result;
	}
	
	async duration() {
		return (await this.executeAction("duration"))[0];
	}

}