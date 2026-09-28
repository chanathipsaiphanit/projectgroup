import CarForm, { CarPayload } from '@/components/car-form';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, normalizeCar, notify } from '@/lib/cars';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function EditCarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ car?: string }>();
  const { user } = useAuth();

  const car = params.car ? normalizeCar(JSON.parse(params.car)) : normalizeCar({});

  const submit = async (payload: CarPayload) => {
    const res = await fetch(api(`/api/inventory/${car.id}`), {
      method: 'PUT',
      headers: authHeaders(user?.token),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update car');
    notify('Car updated successfully!');
    router.back();
  };

  return <CarForm title="Edit Car" submitLabel="Update Car" initial={car} onSubmit={submit} onCancel={() => router.back()} />;
}
