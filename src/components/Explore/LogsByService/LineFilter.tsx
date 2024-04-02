import { css } from "@emotion/css";
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from "@grafana/scenes";
import { Field, Input } from "@grafana/ui";
import React from "react";

interface LineFilterState extends SceneObjectState {
	search: string;
}

export class LineFilter extends SceneObjectBase<LineFilterState> {
	static Component = LineFilterRenderer;

	public constructor(state?: Partial<LineFilterState>) {
		super({ search: '', ...state });
	}
}

function LineFilterRenderer({ model }: SceneComponentProps<LineFilter>) {
  const { search } = model.useState();

  return (
    <Field>
			<Input value={search} className={styles.input} placeholder="Search" />
		</Field>
  );
}

const styles = {
	input: css({
		width: '100%',
	})
}
