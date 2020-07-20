
// Cypress tests are usually written in three phases: "Given, When, Then"

describe("Cube Cobra Landing", () => {
  it("opens and renders landing (not logged in)", () => {
    cy.visit("http://localhost:5000/")

    const searchTerms = ["Want to support Cube Cobra?", "Completely free to sign up and use!", "First time here?", "Create Account"]

    for(let i = 0; i < searchTerms.length; i++) {
      cy.contains(searchTerms[i])
    }
  })

  it("sends users to register page after clicking Create Account button", () => {
    cy.visit("http://localhost:5000/")

    cy.contains("Create Account").click()

    cy.url().should("include", "/user/register")
  })

  it("sends users to register page after clicking register nav button", () => {
    cy.visit("http://localhost:5000/")

    cy.contains("Register").click()

    cy.url().should("include", "/user/register")
  })

  it("opens the login modal after clicking the login button", () => {
    cy.visit("http://localhost:5000/")

    cy.get("#loginModal").should("be.not.be.visible")

    cy.contains("Login").click()

    cy.get("#loginModal").should("be.visible")
    cy.contains("Username or Email Address")
    cy.contains("Password")
  })

})