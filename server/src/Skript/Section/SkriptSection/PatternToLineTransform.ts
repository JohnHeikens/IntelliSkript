import { integer } from 'vscode-languageserver/node';

export interface PatternKeyFrame {
    patternPos: integer;
    linePos: integer;
}

/**
 * when modifying a line, you'll be able to find where a part of the line was first.
 * for example, if the line was 'i like bread' first and it becomes 'i % bread',
 * then a keyframe will be added at the space in the pattern behind the '%' to point to the space in the pattern behind the 'like'
 */
export class TransformedPattern {
    pattern: string = '';
    keypoints: PatternKeyFrame[] = [];
    constructor(pattern: string = "") {
        this.pattern = pattern;
    }
    transformPosition(inPos: integer, keyFrameToInPos: (kf: PatternKeyFrame) => number, keyFrameToOutPos: (kf: PatternKeyFrame) => number) {
        if (this.keypoints.length == 0 || inPos < keyFrameToInPos(this.keypoints[0]))
            return inPos;
        for(let keyFrameIndex = this.keypoints.length; --keyFrameIndex >= 0; ){
            const keyFrame = this.keypoints[keyFrameIndex];
            const difference = inPos - keyFrameToInPos(keyFrame);
            if (difference >= 0) {
                return keyFrameToOutPos(keyFrame) + difference;
            }
        }
        //this place should be unreachable
        return 0;
    }
    getLinePos(patternPos: integer): integer {
        return this.transformPosition(patternPos, kf => kf.patternPos, kf => kf.linePos);
    }
    getPatternPos(linePos: integer): integer {
        return this.transformPosition(linePos, kf => kf.linePos, kf => kf.patternPos);
    }
    replaceInPattern(patternStartPos: integer, patternEndPos: integer, lineEndPos: integer = this.getLinePos(patternEndPos)) {
        this.pattern = this.pattern.substring(0, patternStartPos) + '%' + this.pattern.substring(patternEndPos);
        const shift = patternEndPos - (patternStartPos + 1);
        let added = false;
        const newKeyFrame = { patternPos: patternEndPos - shift, linePos: lineEndPos };
        for (let keyframeIndex = 0; keyframeIndex < this.keypoints.length;) {
            const keyFrame = this.keypoints[keyframeIndex];
            if (keyFrame.patternPos > patternStartPos) {
                if (keyFrame.patternPos >= patternEndPos) {
                    if (!added) {
                        added = true;
                        //insert the new keyframe behind this keyframe
                        this.keypoints.splice(keyframeIndex, 0, newKeyFrame);
                        keyframeIndex++;
                    }
                    //shift all keyframes on the right to the left
                    keyFrame.patternPos -= shift;
                }
                else {
                    //remove keyframe, it got replaced by a '%'
                    this.keypoints.splice(keyframeIndex, 1);
                    continue;
                }
            }
            keyframeIndex++;
        }
        if (!added) {
            this.keypoints.push(newKeyFrame);
        }
    }
    replace(lineStartPos: integer, lineEndPos: integer) {
        this.replaceInPattern(this.getPatternPos(lineStartPos), this.getPatternPos(lineEndPos), lineEndPos);
    }
    clone(): TransformedPattern {
        const cloned = new TransformedPattern(this.pattern);
        cloned.keypoints = this.keypoints.map(kp => ({ ...kp }));
        return cloned;
    }
}