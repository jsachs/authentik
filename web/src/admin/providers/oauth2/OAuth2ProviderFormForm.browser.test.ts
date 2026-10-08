import { renderForm } from "./OAuth2ProviderFormForm.js";

import type { SearchSelect } from "#elements/forms/SearchSelect/ak-search-select";
import { serializeForm } from "#elements/forms/serialization";

import { CertificateKeyPair, KeyTypeEnum, OAuth2Provider } from "@goauthentik/api";

import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "lit";

const { certificate, emptyPage } = vi.hoisted(() => ({
    certificate: {
        pk: "11111111-1111-4111-8111-111111111111",
        name: "authentik Self-signed Certificate",
        privateKeyAvailable: true,
        keyType: "rsa",
    },
    emptyPage: { results: [], pagination: { count: 0, totalPages: 1, current: 1 } },
}));

vi.mock("#common/api/client", () => ({
    aki: () => ({
        cryptoCertificatekeypairsList: async () => ({ ...emptyPage, results: [certificate] }),
        flowsInstancesList: async () => emptyPage,
        propertymappingsProviderScopeList: async () => emptyPage,
        providersOauth2List: async () => emptyPage,
        sourcesOauthList: async () => emptyPage,
    }),
}));

const mounted = new Set<HTMLFormElement>();

async function mount(provider: Partial<OAuth2Provider>) {
    certificate.keyType = KeyTypeEnum.Rsa;
    const form = document.body.appendChild(document.createElement("form"));
    mounted.add(form);

    render(
        renderForm({ provider, showLogoutMethod: false, showLogoutMethodCallback: () => {} }),
        form,
    );

    const signingKey = form.querySelector<SearchSelect<CertificateKeyPair>>(
        'ak-search-select[name="signingKey"]',
    )!;

    await signingKey.settled;

    return { form, signingKey };
}

afterEach(() => {
    for (const form of mounted) {
        render(null, form);
        form.remove();
    }

    mounted.clear();
});

describe("OAuth2 provider signing key", () => {
    it("preserves an existing provider's null signing key when only one certificate is available", async () => {
        const { form, signingKey } = await mount({ pk: 1, signingKey: null });

        expect(signingKey.selectedObject).toBeNull();
        expect(signingKey.renderRoot.querySelector("input")!.value).toBe("");
        expect(signingKey.toJSON()).toBeNull();
        expect(serializeForm([signingKey])).toEqual({ signingKey: null });
        expect(new FormData(form).get("signingKey")).toBe("");

        await signingKey.refresh();
        await signingKey.settled;
        expect(signingKey.toJSON()).toBeNull();
    });

    it("keeps the sole certificate as the default for a new provider", async () => {
        const { signingKey } = await mount({});

        expect(signingKey.toJSON()).toBe(certificate.pk);
        expect(signingKey.renderRoot.querySelector("input")!.value).toBe(certificate.name);
    });

    it("loads an existing signing key and allows it to be cleared without preselecting it again", async () => {
        const { signingKey } = await mount({ pk: 1, signingKey: certificate.pk });

        expect(signingKey.toJSON()).toBe(certificate.pk);
        expect(signingKey.renderRoot.querySelector("input")!.value).toBe(certificate.name);

        signingKey.select(null);
        await signingKey.refresh();
        await signingKey.settled;

        expect(signingKey.toJSON()).toBeNull();
        expect(signingKey.renderRoot.querySelector("input")!.value).toBe("");
    });

    it("serializes an explicitly selected certificate for an existing provider with no signing key", async () => {
        const { form, signingKey } = await mount({ pk: 1, signingKey: null });

        signingKey.show();
        await signingKey.updateComplete;

        const certificateOption = Array.from(
            signingKey.renderRoot.querySelectorAll<HTMLElement>('[role="option"]'),
        ).find((item) => item.textContent?.includes(certificate.name))!;

        certificateOption.click();
        await signingKey.settled;

        expect(signingKey.toJSON()).toBe(certificate.pk);
        expect(serializeForm([signingKey])).toEqual({ signingKey: certificate.pk });
        expect(new FormData(form).get("signingKey")).toBe(certificate.pk);
    });
});
