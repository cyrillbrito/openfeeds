import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { email } = await request.json();

  const resendApiKey = import.meta.env.RESEND_API_KEY;
  const resendAudienceId = import.meta.env.RESEND_AUDIENCE_ID;

  if (!resendApiKey || !resendAudienceId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Waitlist service not configured',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const resend = new Resend(resendApiKey);

    await resend.contacts.create({
      email,
      audienceId: resendAudienceId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully added to waitlist',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Resend error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to add to waitlist',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
