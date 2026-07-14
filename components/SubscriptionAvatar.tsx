import { icons } from '@/constants/icons';
import { getAvatarColor, getInitials, resolveIconKey } from '@/lib/icon-resolver';
import { Image, Text, View } from 'react-native';

interface SubscriptionAvatarProps {
    name: string;
    iconKey?: string | null;
    className: string;
}

const SubscriptionAvatar = ({ name, iconKey, className }: SubscriptionAvatarProps) => {
    const resolvedKey = resolveIconKey(name, iconKey);

    if (resolvedKey) {
        return <Image source={icons[resolvedKey]} className={className} resizeMode="contain" />;
    }

    return (
        <View
            className={className}
            style={{ backgroundColor: getAvatarColor(name || 'subscription'), alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel={`${name} icon`}
        >
            <Text className="font-sans-bold text-primary">{getInitials(name)}</Text>
        </View>
    );
};

export default SubscriptionAvatar;
