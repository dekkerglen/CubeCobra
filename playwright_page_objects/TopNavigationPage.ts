import { Page } from "@playwright/test";

import { getMagicAnswer } from "../playwright_data/securityQuestions";

export class TopNavigationPage {
    page: any;
    yourCubeDropdown: any;
    loginLink: any;
    emailField: any;
    passwordField: any;
    loginButton: any;
    createNewCubeLink: any;
    cubeNameField: any;
    cubeSecurityQuestionField: any;
    captchaCheckbox: any;
    securityQuestionText: any;
    cardSearchField: any;
    cardsLink: any;
    searchCardsLink: any;
    
    constructor(page: Page) {
        this.page = page;
        this.loginLink = page.getByText('Login').first()
        this.emailField = page.getByLabel('Username or Email Address')
        this.passwordField = page.getByLabel('Password')
        this.loginButton = page.getByRole('button', { name: 'Login' })
        this.yourCubeDropdown = page.getByText('Your Cubes', { exact: true }).nth(1)
        this.createNewCubeLink = page.getByText('Create A New Cube').nth(1)
        this.cubeNameField = page.locator('input[type="text"]')
        this.cubeSecurityQuestionField = page.getByLabel('Security Question:')
        this.securityQuestionText = page.locator('label[for="answer"]')
        this.cardsLink = page.getByText('Cards', { exact: true }).nth(1)
        this.searchCardsLink = page.getByRole('link', { name: 'Search Cards' }).first()

    }

    userLogin = async () => {
        await this.loginLink.waitFor();
        await this.loginLink.click();
        await this.emailField.waitFor()
        await this.emailField.fill('test@test.com')
        await this.passwordField.waitFor()
        await this.passwordField.fill('riley123')
        await this.loginButton.waitFor()
        await this.loginButton.click()
        await this.page.waitForURL(/\/dashboard/)
    }
    createNewCube = async (cubeName: string) => {
        await this.yourCubeDropdown.waitFor()
        await this.yourCubeDropdown.click()
        await this.createNewCubeLink.waitFor()
        await this.createNewCubeLink.click()
        await this.cubeNameField.waitFor()
        await this.cubeNameField.fill(cubeName)
        await this.cubeSecurityQuestionField.waitFor()
        const question = await this.securityQuestionText.innerText()
        console.log(question)
        const answer = getMagicAnswer(question)
        await this.cubeSecurityQuestionField.fill(answer)
        // need a way to bypass captcha
        await this.page.pause()
    }
    clickSearchCardDropDownLink = async () => {
        await this.cardsLink.waitFor()
        await this.cardsLink.click()
        await this.searchCardsLink.waitFor()
        await this.searchCardsLink.click()
        await this.page.waitForURL(/\/tool/)
    }
    }
