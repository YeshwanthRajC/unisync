import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architectural boundaries enforced as lint failures.
 *
 * Two of the rules below are load-bearing security controls rather than style
 * preferences, so they are written here — where CI already runs them — instead of
 * living in a document nobody re-reads.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    /*
     * The AI layer may never import the human-intent module.
     *
     * `mintHumanIntent` produces the branded token that `closeAppointment`,
     * `confirmPayment` and `sendPatientEmail` require. The brand is a `unique
     * symbol`, so the token cannot be forged by an object literal — but it could
     * be *obtained* by importing the minting function. This rule closes that
     * route, which is what makes "the agent cannot close an appointment" a
     * property of the build rather than of a code review.
     *
     * It also may not reach the database directly: AI tools call service
     * functions, which carry the tenant scoping and the audit trail with them.
     */
    files: ["lib/ai/**/*.ts", "lib/ai/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/auth/human-intent",
              message:
                "The AI layer must never mint human intent. Closing an appointment, confirming a payment and sending a patient email are decisions a person makes; the agent may prepare them and ask. See lib/auth/human-intent.ts.",
            },
            {
              name: "@/lib/db/prisma",
              message:
                "AI tools must go through a service function in services/<module>, which applies tenant scoping and writes the audit record. Direct Prisma access from a tool would bypass both.",
            },
          ],
        },
      ],
    },
  },

  {
    /*
     * UI code may not query the database directly.
     *
     * Every read must go through a service that takes an `OrganizationContext`,
     * because that context is the only thing carrying a verified organizationId.
     * A page that reaches for `prisma` has, by construction, no tenant scope.
     */
    files: [
      "app/**/*.ts",
      "app/**/*.tsx",
      "components/**/*.ts",
      "components/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/prisma",
              message:
                "Pages, components and route handlers must read through services/<module>, which scope every query to the session's organization. Import the service, not the client.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db/generated", "@/lib/db/generated/*"],
              message:
                "Do not import the generated Prisma client into UI code. Export the shape you need as a type from the service module instead.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/db/generated/**",
  ]),
]);

export default eslintConfig;
