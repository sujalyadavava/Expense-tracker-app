const form = document.getElementById("signupForm");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };
  const confirmPassword = document.getElementById("confirmPassword").value;

  const message = document.getElementById("message");
  if (!user.password || !confirmPassword) {
    message.textContent = "Password and confirmation are required.";
    return;
  }
  if (user.password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }

  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Signup failed.");
    }

    window.location.href = "login.html?registered=true";
  } catch (error) {
    message.textContent = error.message;
  }
});
