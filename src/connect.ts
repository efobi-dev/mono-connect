import { z } from "zod";
import type {
	ConnectEventData,
	ConnectEventName,
	ConnectOptions,
	ConnectSuccessData,
	Institution,
	SetupConfig,
} from "./types";
import { ConnectWidget } from "./widget";

const COVERAGE_URL = "https://api.withmono.com/coverage";

// --- Internal runtime validation schemas (kept private so declaration emit
// stays compatible with `isolatedDeclarations`). --------------------------------

const authMethodSchema = z.enum(["internet_banking", "mobile_banking"]);

const selectedInstitutionSchema = z.object({
	id: z.string(),
	auth_method: authMethodSchema,
	account_number: z.string().optional(),
});

const setupConfigSchema = z
	.object({
		selectedInstitution: selectedInstitutionSchema.optional(),
		check_account_match: z.boolean().optional(),
	})
	.catchall(z.unknown());

const optionsSchema = z
	.object({
		key: z.string().min(1, "key is required"),
		scope: z.string().optional(),
		reference: z.string().optional(),
		data: z.record(z.string(), z.unknown()).optional(),
		onSuccess: z.function(),
		onClose: z.function().optional(),
		onLoad: z.function().optional(),
		onEvent: z.function().optional(),
	})
	.catchall(z.unknown());

const institutionsSchema = z.array(
	z.object({}).catchall(z.unknown()),
);

const noop = (): void => {};

/** Keys consumed by the SDK itself and therefore never forwarded to the widget. */
const RESERVED_KEYS = new Set([
	"key",
	"onSuccess",
	"onClose",
	"onLoad",
	"onEvent",
]);

interface MessagePayload {
	type?: string;
	data?: ConnectEventData & ConnectSuccessData;
}

/**
 * Type-safe, framework-agnostic client for the Mono Connect widget.
 *
 * @example
 * ```ts
 * const connect = new Connect({
 *   key: "mono_public_key",
 *   scope: "auth",
 *   onSuccess: ({ code }) => console.log("auth code", code),
 * });
 * connect.setup();
 * connect.open();
 * ```
 */
export class Connect {
	private readonly key: string;
	private readonly config: Record<string, unknown>;
	private readonly onSuccess: (data: ConnectSuccessData) => void;
	private readonly onClose: () => void;
	private readonly onLoad: () => void;
	private readonly onEvent: (
		eventName: ConnectEventName,
		data: ConnectEventData,
	) => void;
	private readonly widget: ConnectWidget;
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	constructor(options: ConnectOptions) {
		const parsed = optionsSchema.parse(options);

		this.key = parsed.key;
		this.onSuccess = parsed.onSuccess as (data: ConnectSuccessData) => void;
		this.onClose = (parsed.onClose as (() => void) | undefined) ?? noop;
		this.onLoad = (parsed.onLoad as (() => void) | undefined) ?? noop;
		this.onEvent =
			(parsed.onEvent as
				| ((eventName: ConnectEventName, data: ConnectEventData) => void)
				| undefined) ?? noop;

		this.config = {};
		for (const [name, value] of Object.entries(options)) {
			if (RESERVED_KEYS.has(name) || typeof value === "function") continue;
			this.config[name] = value;
		}

		this.widget = new ConnectWidget();
	}

	/** Mounts the (hidden) widget onto the DOM. */
	setup(setupConfig: SetupConfig = {}): void {
		const overrides = setupConfigSchema.parse(setupConfig);
		this.widget.addStyle();
		this.widget.mount({
			key: this.key,
			qs: { ...this.config, ...overrides },
			onLoad: this.onLoad,
			onEvent: this.onEvent,
		});
	}

	/** Mounts the re-authorisation widget for an existing account. */
	reauthorise(accountId: string): void {
		if (typeof accountId !== "string" || accountId.length === 0) {
			throw new Error("A non-empty accountId string is required for re-authorisation");
		}

		this.widget.addStyle();
		const existingData =
			(this.config.data as Record<string, unknown> | undefined) ?? {};
		this.widget.mount({
			key: this.key,
			qs: {
				...this.config,
				data: { ...existingData, account: accountId },
			},
			onLoad: this.onLoad,
			onEvent: this.onEvent,
		});
	}

	/** Reveals the widget and starts listening for events. */
	open(): void {
		if (typeof window === "undefined") {
			throw new Error("`open()` can only be called in a browser environment.");
		}

		this.widget.open();

		this.messageHandler = (event: MessageEvent): void => {
			const payload = event.data as MessagePayload | undefined;
			if (!payload || typeof payload.type !== "string") return;
			const data = payload.data ?? {};

			switch (payload.type) {
				case "mono.connect.widget.charge_complete":
				case "mono.connect.widget.account_linked":
					this.onSuccess({ ...data });
					this.onEvent("SUCCESS", data);
					this.close();
					break;
				case "mono.connect.widget.closed":
					this.close();
					break;
				case "mono.connect.widget_opened":
					this.onEvent("OPENED", data);
					break;
				case "mono.connect.error_occured":
					this.onEvent("ERROR", data);
					break;
				case "mono.connect.institution_selected":
					this.onEvent("INSTITUTION_SELECTED", data);
					break;
				case "mono.connect.auth_method_switched":
					this.onEvent("AUTH_METHOD_SWITCHED", data);
					break;
				case "mono.connect.on_exit":
					this.onEvent("EXIT", data);
					break;
				case "mono.connect.login_attempt":
					this.onEvent("SUBMIT_CREDENTIALS", data);
					break;
				case "mono.connect.mfa_submitted":
					this.onEvent("SUBMIT_MFA", data);
					break;
				case "mono.connect.account_linked":
					this.onEvent("ACCOUNT_LINKED", data);
					break;
				case "mono.connect.account_selected":
					this.onEvent("ACCOUNT_SELECTED", data);
					break;
			}
		};

		window.addEventListener("message", this.messageHandler, false);
	}

	/** Hides the widget and cleans up its event listener. */
	close(): void {
		if (typeof window !== "undefined" && this.messageHandler) {
			window.removeEventListener("message", this.messageHandler, false);
			this.messageHandler = null;
		}
		this.widget.close();
		this.onClose();
	}

	/** Fetches the list of supported institutions from the Mono coverage API. */
	async fetchInstitutions(): Promise<Institution[]> {
		const response = await fetch(COVERAGE_URL);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch institutions: ${response.status} ${response.statusText}`,
			);
		}
		const json: unknown = await response.json();
		return institutionsSchema.parse(json) as Institution[];
	}
}
