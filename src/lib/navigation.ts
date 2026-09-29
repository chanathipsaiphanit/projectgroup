import { useRouter } from 'expo-router';

// "Back" that also works after a page refresh or when a page was opened
// from a link: with no history to go back to, it goes to the home page.
export function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}
