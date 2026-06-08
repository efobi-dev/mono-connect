import { Connect } from "./connect";

export { Connect } from "./connect";
export type {
	AuthMethod,
	ConnectData,
	ConnectEventData,
	ConnectEventName,
	ConnectOptions,
	ConnectSuccessData,
	Customer,
	ExistingCustomer,
	Identity,
	Institution,
	NewCustomer,
	SelectedInstitution,
	SetupConfig,
} from "./types";
export { CONNECT_EVENTS } from "./types";

// Expose on `window` for script-tag / UMD-style consumers, mirroring the
// legacy `window.Connect` global. No-op when imported server-side.
if (typeof window !== "undefined") {
	(window as unknown as { Connect?: typeof Connect }).Connect = Connect;
}

export default Connect;
