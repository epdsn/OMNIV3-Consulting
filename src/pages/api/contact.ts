import type { APIRoute } from "astro";

type ContactPayload = {
  name?: string;
  email?: string;
  company?: string;
  projectDetails?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST: APIRoute = async ({ request }) => {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return new Response(
      JSON.stringify({ message: "Invalid request body. Please send JSON data." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const name = payload.name?.trim() ?? "";
  const email = payload.email?.trim() ?? "";
  const projectDetails = payload.projectDetails?.trim() ?? "";

  if (!name || !email || !projectDetails) {
    return new Response(
      JSON.stringify({ message: "Name, email, and project details are required." }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!isValidEmail(email)) {
    return new Response(
      JSON.stringify({ message: "Please provide a valid email address." }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (projectDetails.length < 30) {
    return new Response(
      JSON.stringify({
        message: "Please share at least 30 characters of project details.",
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 800));

  return new Response(
    JSON.stringify({
      message:
        "Project brief received. You can now replace this mock handler with email or CRM integration.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
