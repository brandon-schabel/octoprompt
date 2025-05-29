import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormProps, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

type UseZodFormProps<T extends z.ZodType> = Omit<
    UseFormProps<z.infer<T>>,
    'resolver'
> & {
    schema: T;
};

export default function useZodForm<T extends z.ZodType>({
    schema,
    ...formProps
}: UseZodFormProps<T>): UseFormReturn<z.infer<T>> {
    return useForm({
        ...formProps,
        resolver: zodResolver(schema),
        mode: 'onChange',
        reValidateMode: 'onSubmit',
    });
}
