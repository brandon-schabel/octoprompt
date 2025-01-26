import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { useGetKvValue, useSetKvValue } from '@/hooks/api/use-kv-api';
import { KVKeyEnum, KVValue } from 'shared/index';

export const Route = createFileRoute('/counter')({
    component: CounterPage
})


export const CounterComponent = (
) => {
    const { data: counter, isLoading } = useGetKvValue(KVKeyEnum.counter);

    const setCounterMutation = useSetKvValue(KVKeyEnum.counter);


    const increment = () => {
        if (typeof counter === 'number') {
            setCounterMutation.mutate({ newValue: counter + 1 });
        } else {
            setCounterMutation.mutate({ newValue: 1 });
        }
    };

    const decrement = () => {
        if (typeof counter === 'number' && counter > 0) {
            setCounterMutation.mutate({ newValue: counter - 1 });
        }
    };

    const reset = () => {
        setCounterMutation.mutate({ newValue: 0 });
    };


    return (
        <div className="flex flex-col items-center gap-4">
            <div className="text-4xl font-bold">
                {isLoading ? 'Loading...' : counter ?? 0}
            </div>
            <div className="flex gap-2">
                <Button
                    onClick={decrement}
                    disabled={isLoading || !counter || counter <= 0}
                >
                    Decrement
                </Button>
                <Button
                    onClick={increment}
                    disabled={isLoading}
                >
                    Increment
                </Button>
                <Button
                    variant="outline"
                    onClick={reset}
                    disabled={isLoading}
                >
                    Reset
                </Button>
            </div>
        </div>
    )
}

function CounterPage() {
    return (
        <div className="p-4 space-y-4 bg-secondary h-full">
            <Card>
                <CardHeader>
                    <CardTitle>Counter</CardTitle>
                    <CardDescription>
                        A simple counter using KV store
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CounterComponent />

                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 