import {View, Text, TouchableOpacity} from 'react-native'

const ListHeading = ({ title, onActionPress }: ListHeadingProps) => {
    return (
        <View className="list-head">
            <Text className="list-title">{title}</Text>

            {onActionPress && (
                <TouchableOpacity className="list-action" onPress={onActionPress} accessibilityRole="button" accessibilityLabel={`View all ${title}`}>
                    <Text className="list-action-text">View all</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

export default ListHeading
