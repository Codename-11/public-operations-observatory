'use server';

import { revalidatePath } from 'next/cache';

import { requestOverviewRefresh } from './api';

export interface RefreshActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export async function refreshOverview(
  _previous: RefreshActionState,
  formData: FormData,
): Promise<RefreshActionState> {
  const projectKey = formData.get('projectKey');
  if (projectKey !== 'hermes-relay') {
    return { status: 'error', message: 'Refresh is unavailable for this project.' };
  }

  const result = await requestOverviewRefresh(projectKey);
  if (!result.ok) {
    return { status: 'error', message: 'Refresh failed. Existing observations remain visible.' };
  }

  revalidatePath(`/projects/${projectKey}`);
  revalidatePath(`/projects/${projectKey}/reach-acquisition`);
  revalidatePath(`/projects/${projectKey}/delivery-sources`);
  return { status: 'success', message: 'Refresh completed with the latest source observations.' };
}
