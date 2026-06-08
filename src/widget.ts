import { containerStyle, iframeStyle, loaderStyles } from "./styles";
import type { ConnectEventData, ConnectEventName } from "./types";

const WIDGET_VERSION = "2023-12-14";
const CONNECT_URL = "https://connect.mono.co";
const CONTAINER_ID = "mono-connect--widget-div";
const FRAME_ID = "mono-connect--frame-id";
const LOADER_ID = "mono-connect-app-loader";
const STYLE_ID = "mono-connect--styles";

/** Keys whose values must be JSON-encoded before being placed in the URL. */
const ENCODED_KEYS = new Set(["data", "selectedInstitution"]);

/** Configuration passed to {@link ConnectWidget.mount}. */
export interface WidgetMountConfig {
	/** The Mono public key. */
	key: string;
	/** Query parameters forwarded to the widget. */
	qs: Record<string, unknown>;
	/** Invoked once the iframe has loaded. */
	onLoad: () => void;
	/** Invoked for widget lifecycle events. */
	onEvent: (eventName: ConnectEventName, data: ConnectEventData) => void;
}

/** Guards against running DOM code in a non-browser environment. */
function assertBrowser(): void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		throw new Error(
			"Mono Connect can only be used in a browser environment (no `window`/`document` found).",
		);
	}
}

/**
 * Encapsulates all DOM/iframe handling for a single Connect instance.
 *
 * Unlike the legacy implementation this keeps per-instance state, so multiple
 * widgets can safely coexist.
 */
export class ConnectWidget {
	private buildUrl(key: string, qs: Record<string, unknown>): string {
		const source = new URL(CONNECT_URL);
		source.searchParams.set("key", key);
		source.searchParams.set("referrer", window.location.href);
		source.searchParams.set("version", WIDGET_VERSION);

		for (const [name, value] of Object.entries(qs)) {
			if (value === undefined || value === null) continue;
			if (ENCODED_KEYS.has(name)) {
				source.searchParams.set(name, JSON.stringify(value));
			} else {
				source.searchParams.set(name, String(value));
			}
		}

		return source.href;
	}

	/** Injects the loader stylesheet once. */
	addStyle(): void {
		assertBrowser();
		if (document.getElementById(STYLE_ID)) return;
		const styleSheet = document.createElement("style");
		styleSheet.id = STYLE_ID;
		styleSheet.textContent = loaderStyles;
		document.head.appendChild(styleSheet);
	}

	/** Builds and mounts the (hidden) widget container and iframe. */
	mount(config: WidgetMountConfig): void {
		assertBrowser();

		// Remove any previously mounted widget to avoid duplicates.
		document.getElementById(CONTAINER_ID)?.remove();

		const container = document.createElement("div");
		container.id = CONTAINER_ID;
		container.setAttribute("style", containerStyle);
		document.body.insertBefore(container, document.body.childNodes[0] ?? null);

		const iframe = document.createElement("iframe");
		iframe.src = this.buildUrl(config.key, config.qs);
		iframe.id = FRAME_ID;
		iframe.setAttribute("style", iframeStyle);
		iframe.setAttribute("allowfullscreen", "true");
		iframe.setAttribute("frameborder", "0");
		iframe.setAttribute("title", "Mono connect");
		iframe.setAttribute(
			"sandbox",
			"allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups",
		);
		iframe.setAttribute("allow", "clipboard-write; clipboard-read; camera");

		iframe.onload = () => {
			const loader = document.getElementById(LOADER_ID);
			if (loader && iframe.style.visibility === "visible") {
				loader.style.display = "none";
			}
			config.onLoad();
			// Connect does not listen for events until the widget is opened, so the
			// LOADED event is delivered directly here.
			config.onEvent("LOADED", { timestamp: Date.now() });
		};

		container.appendChild(this.createLoader());
		container.appendChild(iframe);
	}

	/** Reveals the widget and emits the OPENED event after a short delay. */
	open(): void {
		assertBrowser();
		const container = document.getElementById(CONTAINER_ID);
		const loader = document.getElementById(LOADER_ID);
		const frame = document.getElementById(FRAME_ID);
		if (!container || !frame) {
			throw new Error("Mono Connect widget is not mounted. Call `setup()` first.");
		}

		container.style.visibility = "visible";
		container.style.display = "flex";
		if (loader) loader.style.display = "block";

		setTimeout(() => {
			this.setVisibility(true);
			(frame as HTMLIFrameElement).focus({ preventScroll: false });
			(container as HTMLElement).focus?.({ preventScroll: false });

			const event = new Event("message") as Event & { data?: unknown };
			event.data = {
				type: "mono.connect.widget_opened",
				data: { timestamp: Date.now() },
			};
			window.dispatchEvent(event);
		}, 2000);
	}

	/** Hides the widget. */
	close(): void {
		assertBrowser();
		this.setVisibility(false);
	}

	private setVisibility(visible: boolean): void {
		const container = document.getElementById(CONTAINER_ID);
		const frame = document.getElementById(FRAME_ID);
		if (!container || !frame) return;
		container.style.display = visible ? "flex" : "none";
		frame.style.display = visible ? "block" : "none";
		container.style.visibility = visible ? "visible" : "hidden";
		frame.style.visibility = visible ? "visible" : "hidden";
	}

	private createLoader(): HTMLDivElement {
		const loaderDiv = document.createElement("div");
		loaderDiv.id = LOADER_ID;
		loaderDiv.classList.add("app-loader");

		const childDiv = document.createElement("div");
		childDiv.classList.add("app-loader__spinner");
		for (let i = 0; i < 12; i++) {
			childDiv.appendChild(document.createElement("div"));
		}

		loaderDiv.appendChild(childDiv);
		return loaderDiv;
	}
}
