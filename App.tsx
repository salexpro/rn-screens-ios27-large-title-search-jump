import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScrollView, Text } from 'react-native';

const Stack = createNativeStackNavigator();

function Home() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      {Array.from({ length: 40 }, (_, i) => (
        <Text key={i} style={{ padding: 16 }}>
          Row {i}
        </Text>
      ))}
    </ScrollView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={Home}
          options={{
            title: 'Markets',
            headerLargeTitle: true,
            headerSearchBarOptions: { placement: 'stacked', hideWhenScrolling: false },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
