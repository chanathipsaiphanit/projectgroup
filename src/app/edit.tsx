import CarForm, { CarPayload } from '@/components/car-form';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, normalizeCar, notify } from '@/lib/cars';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoBack } from '@/lib/navigation';

export default function EditCarScreen() {
  const router = useRouter();
  const goBack = useGoBack();
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
    if (!res.ok) throw new Error(data.error || 'แก้ไขข้อมูลรถไม่สำเร็จ');
    notify('แก้ไขข้อมูลรถเรียบร้อยแล้ว!');
    goBack();
  };

  return <CarForm title="แก้ไขข้อมูลรถ" titleEn="Edit Car" submitLabel="บันทึกการแก้ไข" initial={car} onSubmit={submit} onCancel={() => goBack()} />;
}
