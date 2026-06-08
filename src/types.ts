/**
 * Public type definitions for the Mono Connect SDK.
 *
 * These types are hand-written (rather than derived from the internal Zod
 * schemas) so that declaration emission stays compatible with
 * `isolatedDeclarations`. The Zod schemas in `connect.ts` validate the same
 * shapes at runtime.
 */

/** Authentication method shown by an institution. */
export type AuthMethod = "internet_banking" | "mobile_banking";

/** Pre-select an institution so the widget opens straight to its login page. */
export interface SelectedInstitution {
	/** The institution id to load. */
	id: string;
	/** The authentication method to use. */
	auth_method: AuthMethod;
	/** The customer's account number, used by the Account Match feature. */
	account_number?: string;
}

/** A customer's identity document. */
export interface Identity {
	/** e.g. `"bvn"`. */
	type: string;
	/** The document number. */
	number: string;
}

/** Create a new Mono customer inline. */
export interface NewCustomer {
	name: string;
	email: string;
	identity?: Identity;
}

/** Reference an existing Mono customer by id. */
export interface ExistingCustomer {
	id: string;
}

export type Customer = NewCustomer | ExistingCustomer;

/**
 * The `data` payload forwarded to the widget. Carries customer details for the
 * `auth` scope and charge details for the `payments` scope. Additional keys are
 * passed through untouched.
 */
export interface ConnectData {
	customer?: Customer;
	/** e.g. `"one-time-debit"` or `"recurring-debit"` (payments scope). */
	type?: string;
	/** Amount in kobo (payments scope). */
	amount?: number;
	description?: string;
	/** Account id, set automatically by `reauthorise()`. */
	account?: string;
	[key: string]: unknown;
}

/** All event names emitted through the `onEvent` callback. */
export const CONNECT_EVENTS = [
	"LOADED",
	"OPENED",
	"EXIT",
	"INSTITUTION_SELECTED",
	"AUTH_METHOD_SWITCHED",
	"SUBMIT_CREDENTIALS",
	"SUBMIT_MFA",
	"ACCOUNT_LINKED",
	"ACCOUNT_SELECTED",
	"SUCCESS",
	"ERROR",
] as const;

export type ConnectEventName = (typeof CONNECT_EVENTS)[number];

/** Metadata passed alongside an `onEvent` callback. */
export interface ConnectEventData {
	reference?: string;
	errorType?: string;
	errorMessage?: string;
	mfaType?: string;
	prevAuthMethod?: string;
	authMethod?: string;
	pageName?: string;
	selectedAccountsCount?: number;
	institution?: { id: string; name: string };
	timestamp?: number;
	[key: string]: unknown;
}

/** Payload passed to `onSuccess`. */
export interface ConnectSuccessData {
	/** Auth code returned after a successful account link. */
	code?: string;
	[key: string]: unknown;
}

/** Optional configuration accepted by `setup()`. */
export interface SetupConfig {
	selectedInstitution?: SelectedInstitution;
	check_account_match?: boolean;
	[key: string]: unknown;
}

/** Options accepted by the `Connect` constructor. */
export interface ConnectOptions {
	/** Your Mono public key from the dashboard. **Required**. */
	key: string;
	/** e.g. `"auth"` or `"payments"`. */
	scope?: string;
	/** A reference echoed back in every `onEvent` payload. */
	reference?: string;
	/** Customer or charge data forwarded to the widget. */
	data?: ConnectData;
	/** Called when a user successfully completes the flow. **Required**. */
	onSuccess: (data: ConnectSuccessData) => void;
	/** Called when the widget is closed. */
	onClose?: () => void;
	/** Called when the widget is mounted to the DOM. */
	onLoad?: () => void;
	/** Called for each event in the Connect flow. */
	onEvent?: (eventName: ConnectEventName, data: ConnectEventData) => void;
	[key: string]: unknown;
}

/** A financial institution returned by `fetchInstitutions()`. */
export interface Institution {
	id?: string;
	name?: string;
	type?: string;
	[key: string]: unknown;
}
