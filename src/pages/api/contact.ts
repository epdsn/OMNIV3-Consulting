import type { APIRoute } from "astro";

type ContactPayload = {
  name?: string;
  email?: string;
  company?: string;
  package?: string;
  projectDetails?: string;
};

const allowedPackages = new Set(["core", "growth", "flagship", "unsure"]);

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
  const selectedPackage = payload.package?.trim() ?? "unsure";

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

  if (selectedPackage && !allowedPackages.has(selectedPackage)) {
    return new Response(
      JSON.stringify({ message: "Please choose a valid package option." }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 800));

  return new Response(
    JSON.stringify({
      message: "Received. We’ll reply within one business day with a plan.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
