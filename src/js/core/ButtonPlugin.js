import Plugin, { getPluginsOfType } from 'paella-core/js/core/Plugin';

export function getButtonPlugins(player) {
	return getPluginsOfType(player, "button");
}

export function getLeftButtonPlugins(player) {
	return getButtonPlugins(player).filter(btn => btn.side === "left");
}

export function getRightButtonPlugins(player) {
	return getButtonPlugins(player).filter(btn => btn.side === "right");
}

export default class ButtonPlugin extends Plugin {
	get type() { return "button" }
	
	// this._button is loaded in PlaybackBar
	get button() { return this._button; }
	
	get iconElement() {
		return this.button?.getElementsByClassName("button-icon")[0];
	}
	
	get icon() {
		return this._icon;
	}
	
	set icon(icon) {
		this._icon = icon;
		this.iconElement.innerHTML = icon;
	}
	
	// "left" or "right"
	get side() {
		const side = this.config?.side;
		return side || "left";
	}
	
	get className() { return ""; }
	
	hide() {
		if (this._button) {
			this._button.style.display = "none";
		}
	}
	
	show() {
		if (this._button) {
			this._button.style.display = "block";
		}
	}
	
	async action() {
		console.log(`Action not implemented in button plugin ${ this.name }`);	
	}
}