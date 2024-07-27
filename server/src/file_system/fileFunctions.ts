import { URI, Utils } from 'vscode-uri';
//https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Syntax

export const URISeparator = '/';
export function addToPath(uri: string, add: string): string {
	return uri + URISeparator + add;
}

export function addToUri(uri: URI, add: string): URI {
	return Utils.joinPath(uri, add);
}


export function isRelativeURI(base: URI, child: URI): boolean {
	return child.path.startsWith(base.path);
}
/**
 * caution! no checking is done to see if this is a relative uri!
 * @param base the uri of a folder, without the slash
 * @param child the uri of a file or folder within that folder
 * @returns a string containing the part of the uri - the base uri and a slash
 */
export function getRelativePathPart(base: URI, child: URI): string {
	return child.path.substring(base.path.length + URISeparator.length);
}