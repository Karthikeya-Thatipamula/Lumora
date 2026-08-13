import type { ImageSourcePropType } from 'react-native';

/**
 * Ambient globals for the tab-bar shapes only.
 *
 * `Subscription` used to live here too, hand-written and globally visible. It duplicated
 * `convex/schema.ts` and had already drifted from it — a `frequency` field the database
 * never had, and an optional `status` where Convex required one. It now derives from
 * `Doc<'subscriptions'>` in `lib/subscriptionTypes.ts` and is imported like any other
 * type, which is also the convention every component prop already follows.
 *
 * What remains is genuinely ambient: the static tab configuration in `constants/data.ts`
 * and the icon shape the tab bar renders it with.
 */
declare global {
    interface AppTab {
        name: string;
        title: string;
        icon: ImageSourcePropType;
    }

    interface TabIconProps {
        focused: boolean;
        icon: ImageSourcePropType;
    }
}

export {};
