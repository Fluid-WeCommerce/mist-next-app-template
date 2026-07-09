// Droplet configuration.
//
// Declare which webhooks, callbacks, and drop zones this droplet needs. Set
// `enabled: true` to have them registered with Fluid automatically when a
// company installs the droplet (and cleaned up on uninstall).
//
// Everything ships disabled — enable a feature only once you've implemented the
// route/component that backs it.

import type { DropletConfig } from "./schema";

export const dropletConfig: DropletConfig = {
  // Company-specific webhooks (distinct from the global droplet.installed /
  // droplet.uninstalled lifecycle webhooks the droplet owner registers once).
  webhooks: [
    {
      enabled: false,
      resource: "order",
      event: "created",
      description: "Notified when a new order is created",
    },
    {
      enabled: false,
      resource: "order",
      event: "updated",
      description: "Notified when an order is updated",
    },
  ],

  // Callback registrations for Fluid UI extension points. `definition_name`
  // must match a callback definition (YAML) in Fluid.
  callbacks: [
    {
      enabled: false,
      definition_name: "order_validation",
      url: "/api/callbacks/validate-order",
      description: "Validates an order before checkout",
    },
  ],

  // UI components embedded into Fluid pages as iframes.
  dropzones: [
    {
      enabled: false,
      uuid: "mist-checkout-banner",
      name: "Checkout Banner",
      page: "checkout",
      zone: "above_fast_checkout",
      embedPath: "/embed/checkout-banner",
      description: "Example banner rendered above fast checkout",
    },
  ],
};
