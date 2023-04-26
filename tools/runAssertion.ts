export const runAssertion = (assertion: () => void) => {
    try {
        assertion();
        console.log('passed assertion');
    } catch (err: any) {
        console.log('failed assertion:', err.message)
    }
}