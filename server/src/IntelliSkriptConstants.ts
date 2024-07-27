
export const IsDebugMode = !__dirname.includes('johnheikens.intelliskript');
/**
 * capture groups:
 * [0]: returns "-" or ""
 * [1]: returns the whole numbers. for example '43'
 * [2]: returns the decimals. for example '29'
 * so "test -123.45" will return (index: 1, [0]: "-", [1]: "123", [2]: "45")
 */
export const NumberRegExp = /(?:(?<=(?: |^))(-){0,1})(\d+)(?:\.(\d+))?(?!\.)\b/;
export const BooleanRegExp = /(?<=( |^))true|false(?=( |$))/;