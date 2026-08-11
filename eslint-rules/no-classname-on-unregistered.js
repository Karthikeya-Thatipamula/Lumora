'use strict';

/**
 * NativeWind only maps `className` onto components it has registered — the core
 * React Native set. Pass `className` to anything else and the prop is silently
 * dropped: no error, no warning, the element just renders unstyled. That has
 * already cost this project three rounds of "blank page" and "unreadable text"
 * bugs, which is why `scripts/check-classname-interop.mjs` exists.
 *
 * This is the in-editor version of that guard. It is intrinsic to how NativeWind
 * works in both v4 and v5 — not a bug in the preview build — so the fix is always
 * to register the component rather than to wait for an upstream release.
 *
 * The sanctioned fixes, in order of preference:
 *   1. Use an existing wrapper — `@/components/SafeAreaView`, `@/components/motion/Animated`
 *   2. `styled(Component)` for a straight className -> style mapping
 *   3. `cssInterop` / `remapProps` when the component takes several style props
 */

/** Modules whose exports NativeWind does not register. */
const UNREGISTERED_MODULES = new Map([
    [
        'react-native-safe-area-context',
        'import { SafeAreaView } from "@/components/SafeAreaView" instead.',
    ],
    [
        'react-native-reanimated',
        'import { AnimatedView, AnimatedText, AnimatedPressable } from "@/components/motion/Animated" instead.',
    ],
    ['react-native-gifted-charts', 'Pass the chart its own style props, or wrap it with styled() first.'],
    ['react-native-svg', 'Pass SVG style props directly, or wrap the component with styled() first.'],
    ['expo-linear-gradient', 'Wrap it with styled() before using className.'],
    ['expo-image', 'Wrap it with styled(), or use the core React Native Image, which is registered.'],
    ['@expo/vector-icons', "Use the icon's own size and color props instead of className."],
    ['react-native-purchases-ui', 'Wrap it with styled() before using className.'],
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow className on components NativeWind has not registered, where it is silently dropped',
        },
        schema: [],
        messages: {
            unregistered:
                '`className` is silently dropped on <{{name}}> — NativeWind has not registered it, so this element will render unstyled. {{advice}}',
            animated:
                '`className` is silently dropped on <{{name}}> — Animated components are not registered. Import { AnimatedView, AnimatedText, AnimatedPressable } from "@/components/motion/Animated" instead.',
        },
    },

    create(context) {
        /** Local name -> advice, for components imported directly. */
        const directBindings = new Map();
        /** Local name -> advice, for default/namespace imports used as `Ns.Member`. */
        const namespaceBindings = new Map();
        /** Local names bound to a createAnimatedComponent(...) result. */
        const animatedBindings = new Set();

        /** Reads the `className` attribute off a JSX element, if present. */
        function findClassNameAttribute(node) {
            return node.attributes.find(
                (attribute) =>
                    attribute.type === 'JSXAttribute' &&
                    attribute.name.type === 'JSXIdentifier' &&
                    attribute.name.name === 'className'
            );
        }

        /** Renders a JSX element name back to source form for the message. */
        function elementName(nameNode) {
            if (nameNode.type === 'JSXIdentifier') return nameNode.name;
            if (nameNode.type === 'JSXMemberExpression') {
                return `${elementName(nameNode.object)}.${nameNode.property.name}`;
            }
            return 'component';
        }

        return {
            ImportDeclaration(node) {
                const advice = UNREGISTERED_MODULES.get(node.source.value);
                if (advice === undefined) return;

                for (const specifier of node.specifiers) {
                    if (
                        specifier.type === 'ImportDefaultSpecifier' ||
                        specifier.type === 'ImportNamespaceSpecifier'
                    ) {
                        // `Animated` from reanimated is used as `Animated.View`, but a default
                        // export can also be rendered directly — record it both ways.
                        namespaceBindings.set(specifier.local.name, advice);
                        directBindings.set(specifier.local.name, advice);
                    } else if (specifier.type === 'ImportSpecifier') {
                        directBindings.set(specifier.local.name, advice);
                    }
                }
            },

            // const Foo = Animated.createAnimatedComponent(Bar) — the result is unregistered
            // even when Bar was, because createAnimatedComponent returns a fresh component.
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier' || !node.init) return;
                const call = node.init;
                if (call.type !== 'CallExpression') return;

                const callee = call.callee;
                const isCreateAnimated =
                    (callee.type === 'Identifier' && callee.name === 'createAnimatedComponent') ||
                    (callee.type === 'MemberExpression' &&
                        callee.property.type === 'Identifier' &&
                        callee.property.name === 'createAnimatedComponent');

                if (isCreateAnimated) animatedBindings.add(node.id.name);
            },

            JSXOpeningElement(node) {
                const classNameAttribute = findClassNameAttribute(node);
                if (!classNameAttribute) return;

                const name = node.name;

                if (name.type === 'JSXIdentifier') {
                    if (animatedBindings.has(name.name)) {
                        context.report({
                            node: classNameAttribute,
                            messageId: 'animated',
                            data: { name: name.name },
                        });
                        return;
                    }
                    const advice = directBindings.get(name.name);
                    if (advice !== undefined) {
                        context.report({
                            node: classNameAttribute,
                            messageId: 'unregistered',
                            data: { name: name.name, advice },
                        });
                    }
                    return;
                }

                if (name.type === 'JSXMemberExpression' && name.object.type === 'JSXIdentifier') {
                    const advice = namespaceBindings.get(name.object.name);
                    if (advice !== undefined) {
                        context.report({
                            node: classNameAttribute,
                            messageId: 'unregistered',
                            data: { name: elementName(name), advice },
                        });
                    }
                }
            },
        };
    },
};
