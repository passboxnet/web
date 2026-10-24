/** Ports of the test servers. Override with PASSBOX_E2E_PORT to run several suites side by side. */
export const port = Number(process.env.PASSBOX_E2E_PORT ?? 8787);

/**
 * A second server with its own database for the administration tests: its
 * first account becomes instance admin, and switching it to invite-only
 * does not affect the other tests.
 */
export const adminPort = Number(process.env.PASSBOX_E2E_ADMIN_PORT ?? port + 1);
